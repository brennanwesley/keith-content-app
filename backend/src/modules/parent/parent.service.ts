import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  ContentService,
  type ContentTypeSummary,
  type EffectiveContentPreferencesResult,
} from '../content/content.service';
import { contentTypeIdSchema } from '../content/content-id.schema';
import { SupabaseService } from '../supabase/supabase.service';
import type { UpdateChildContentRestrictionsInput } from './parent.schemas';

type AccountType = 'learner' | 'parent' | 'admin';
type RelationshipStatus = 'pending' | 'active' | 'revoked';

const accountTypeSchema = z.enum(['learner', 'parent', 'admin']);

const profileRowSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  account_type: accountTypeSchema,
});

const profileForLookupSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  account_type: accountTypeSchema,
});

const parentChildLinkRowSchema = z.object({
  id: z.string().uuid(),
  parent_user_id: z.string().uuid(),
  child_user_id: z.string().uuid(),
  relationship_status: z.enum(['pending', 'active', 'revoked']),
  linked_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const parentContentRestrictionRowSchema = z.object({
  content_type_id: contentTypeIdSchema,
});

export type ParentLinkSummary = {
  id: string;
  parentUserId: string;
  parentUsername: string;
  childUserId: string;
  childUsername: string;
  relationshipStatus: RelationshipStatus;
  linkedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MyParentLinksResult = {
  userId: string;
  accountType: AccountType;
  asParent: ParentLinkSummary[];
  asChild: ParentLinkSummary[];
};

export type ChildContentRestrictionsResult = {
  parentUserId: string;
  childUserId: string;
  childUsername: string;
  blockedContentTypeIds: string[];
  blockedContentTypes: ContentTypeSummary[];
  effectiveContentPreferences: EffectiveContentPreferencesResult;
};

@Injectable()
export class ParentService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly contentService: ContentService,
  ) {}

  async listMyLinks(userId: string): Promise<MyParentLinksResult> {
    const client = this.getClientOrThrow();
    const profile = await this.getProfileOrThrow(userId);

    const { data: linkRows, error: linkError } = await client
      .from('parent_child_links')
      .select(
        'id, parent_user_id, child_user_id, relationship_status, linked_at, created_at, updated_at',
      )
      .or(`parent_user_id.eq.${userId},child_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (linkError) {
      throw new InternalServerErrorException(
        'Failed to load parent-child links.',
      );
    }

    const parsedLinks = z
      .array(parentChildLinkRowSchema)
      .safeParse(linkRows ?? []);

    if (!parsedLinks.success) {
      throw new InternalServerErrorException(
        'Parent-child links payload was invalid.',
      );
    }

    const relatedUserIds = Array.from(
      new Set(
        parsedLinks.data.flatMap((row) => [
          row.parent_user_id,
          row.child_user_id,
        ]),
      ),
    );

    const profileById = await this.loadProfilesByIds(relatedUserIds);

    const summaries = parsedLinks.data.map((row) =>
      this.mapParentLinkSummary(row, profileById),
    );

    return {
      userId,
      accountType: profile.accountType,
      asParent: summaries.filter((summary) => summary.parentUserId === userId),
      asChild: summaries.filter((summary) => summary.childUserId === userId),
    };
  }

  async requestLinkByChildUsername(
    parentUserId: string,
    childUsername: string,
  ): Promise<ParentLinkSummary> {
    const client = this.getClientOrThrow();
    await this.assertAccountType(parentUserId, 'parent');

    const normalizedUsername = childUsername.trim();

    const { data: childProfile, error: childProfileError } = await client
      .from('profiles')
      .select('id, username, account_type')
      .ilike('username', normalizedUsername)
      .maybeSingle();

    if (childProfileError) {
      throw new InternalServerErrorException(
        'Failed to look up child profile.',
      );
    }

    if (!childProfile) {
      throw new NotFoundException(
        'No learner account found with that username.',
      );
    }

    const parsedChildProfile = profileForLookupSchema.safeParse(childProfile);

    if (!parsedChildProfile.success) {
      throw new InternalServerErrorException(
        'Child profile payload was invalid.',
      );
    }

    const parsedChild = parsedChildProfile.data;

    if (parsedChild.id === parentUserId) {
      throw new BadRequestException(
        'You cannot link your own account as a child.',
      );
    }

    if (parsedChild.account_type !== 'learner') {
      throw new BadRequestException(
        'Only learner accounts can be linked as children.',
      );
    }

    const { data: existingLink, error: existingLinkError } = await client
      .from('parent_child_links')
      .select(
        'id, parent_user_id, child_user_id, relationship_status, linked_at, created_at, updated_at',
      )
      .eq('parent_user_id', parentUserId)
      .eq('child_user_id', parsedChild.id)
      .maybeSingle();

    if (existingLinkError) {
      throw new InternalServerErrorException(
        'Failed to verify existing parent-child link.',
      );
    }

    if (existingLink) {
      const parsedExistingLink =
        parentChildLinkRowSchema.safeParse(existingLink);

      if (!parsedExistingLink.success) {
        throw new InternalServerErrorException(
          'Existing parent link payload was invalid.',
        );
      }

      if (parsedExistingLink.data.relationship_status === 'revoked') {
        const { data: restoredLink, error: restoredLinkError } = await client
          .from('parent_child_links')
          .update({
            relationship_status: 'pending',
            linked_at: null,
          })
          .eq('id', parsedExistingLink.data.id)
          .select(
            'id, parent_user_id, child_user_id, relationship_status, linked_at, created_at, updated_at',
          )
          .single();

        if (restoredLinkError || !restoredLink) {
          throw new InternalServerErrorException(
            'Failed to reopen parent-child link request.',
          );
        }

        const parsedRestoredLink =
          parentChildLinkRowSchema.safeParse(restoredLink);

        if (!parsedRestoredLink.success) {
          throw new InternalServerErrorException(
            'Restored parent link payload was invalid.',
          );
        }

        const profileById = await this.loadProfilesByIds([
          parsedRestoredLink.data.parent_user_id,
          parsedRestoredLink.data.child_user_id,
        ]);

        return this.mapParentLinkSummary(parsedRestoredLink.data, profileById);
      }

      const profileById = await this.loadProfilesByIds([
        parsedExistingLink.data.parent_user_id,
        parsedExistingLink.data.child_user_id,
      ]);

      return this.mapParentLinkSummary(parsedExistingLink.data, profileById);
    }

    const { data: createdLink, error: createdLinkError } = await client
      .from('parent_child_links')
      .insert({
        parent_user_id: parentUserId,
        child_user_id: parsedChild.id,
        relationship_status: 'pending',
      })
      .select(
        'id, parent_user_id, child_user_id, relationship_status, linked_at, created_at, updated_at',
      )
      .single();

    if (createdLinkError || !createdLink) {
      throw new InternalServerErrorException(
        'Failed to create parent-child link request.',
      );
    }

    const parsedCreatedLink = parentChildLinkRowSchema.safeParse(createdLink);

    if (!parsedCreatedLink.success) {
      throw new InternalServerErrorException(
        'Created parent link payload was invalid.',
      );
    }

    const profileById = await this.loadProfilesByIds([
      parsedCreatedLink.data.parent_user_id,
      parsedCreatedLink.data.child_user_id,
    ]);

    return this.mapParentLinkSummary(parsedCreatedLink.data, profileById);
  }

  async acceptLinkById(
    childUserId: string,
    linkId: string,
  ): Promise<ParentLinkSummary> {
    const client = this.getClientOrThrow();

    const link = await this.getParentLinkById(linkId);

    if (link.child_user_id !== childUserId) {
      throw new ForbiddenException(
        'Only the requested child can accept this link.',
      );
    }

    if (link.relationship_status === 'active') {
      const profileById = await this.loadProfilesByIds([
        link.parent_user_id,
        link.child_user_id,
      ]);

      return this.mapParentLinkSummary(link, profileById);
    }

    if (link.relationship_status !== 'pending') {
      throw new BadRequestException('Only pending links can be accepted.');
    }

    const { data: activatedLink, error: activatedLinkError } = await client
      .from('parent_child_links')
      .update({
        relationship_status: 'active',
        linked_at: new Date().toISOString(),
      })
      .eq('id', link.id)
      .select(
        'id, parent_user_id, child_user_id, relationship_status, linked_at, created_at, updated_at',
      )
      .single();

    if (activatedLinkError || !activatedLink) {
      throw new InternalServerErrorException(
        'Failed to activate parent-child link.',
      );
    }

    const parsedActivatedLink =
      parentChildLinkRowSchema.safeParse(activatedLink);

    if (!parsedActivatedLink.success) {
      throw new InternalServerErrorException(
        'Activated parent link payload was invalid.',
      );
    }

    const profileById = await this.loadProfilesByIds([
      parsedActivatedLink.data.parent_user_id,
      parsedActivatedLink.data.child_user_id,
    ]);

    return this.mapParentLinkSummary(parsedActivatedLink.data, profileById);
  }

  async revokeLinkById(
    actorUserId: string,
    linkId: string,
  ): Promise<ParentLinkSummary> {
    const client = this.getClientOrThrow();
    const link = await this.getParentLinkById(linkId);

    const actorCanRevoke =
      link.parent_user_id === actorUserId || link.child_user_id === actorUserId;

    if (!actorCanRevoke) {
      throw new ForbiddenException(
        'Only linked parent or child can revoke this link.',
      );
    }

    if (link.relationship_status !== 'revoked') {
      const { error: cleanupRestrictionsError } = await client
        .from('parent_content_restrictions')
        .delete()
        .eq('parent_user_id', link.parent_user_id)
        .eq('child_user_id', link.child_user_id);

      if (cleanupRestrictionsError) {
        throw new InternalServerErrorException(
          'Failed to clear parent restrictions during revoke.',
        );
      }

      const { error: revokeLinkError } = await client
        .from('parent_child_links')
        .update({
          relationship_status: 'revoked',
          linked_at: null,
        })
        .eq('id', link.id);

      if (revokeLinkError) {
        throw new InternalServerErrorException(
          'Failed to revoke parent-child link.',
        );
      }
    }

    const refreshedLink = await this.getParentLinkById(link.id);
    const profileById = await this.loadProfilesByIds([
      refreshedLink.parent_user_id,
      refreshedLink.child_user_id,
    ]);

    return this.mapParentLinkSummary(refreshedLink, profileById);
  }

  async getChildContentRestrictions(
    parentUserId: string,
    childUserId: string,
  ): Promise<ChildContentRestrictionsResult> {
    await this.assertAccountType(parentUserId, 'parent');
    await this.assertParentChildLinkIsActive(parentUserId, childUserId);

    const childProfile = await this.getProfileOrThrow(childUserId);

    if (childProfile.accountType !== 'learner') {
      throw new BadRequestException(
        'Only learner accounts can be managed by parents.',
      );
    }

    const blockedContentTypeIds = await this.listBlockedContentTypeIdsForPair(
      parentUserId,
      childUserId,
    );

    const effectiveContentPreferences =
      await this.contentService.getEffectiveContentPreferences(childUserId);

    const activeContentTypes = await this.contentService.listContentTypes();
    const activeContentTypeById = new Map(
      activeContentTypes.map((contentType) => [contentType.id, contentType]),
    );

    const blockedContentTypes = blockedContentTypeIds
      .map((contentTypeId) => activeContentTypeById.get(contentTypeId))
      .filter((contentType): contentType is ContentTypeSummary =>
        Boolean(contentType),
      );

    return {
      parentUserId,
      childUserId,
      childUsername: childProfile.username,
      blockedContentTypeIds,
      blockedContentTypes,
      effectiveContentPreferences,
    };
  }

  async replaceChildContentRestrictions(
    parentUserId: string,
    childUserId: string,
    input: UpdateChildContentRestrictionsInput,
  ): Promise<ChildContentRestrictionsResult> {
    const client = this.getClientOrThrow();
    await this.assertAccountType(parentUserId, 'parent');
    await this.assertParentChildLinkIsActive(parentUserId, childUserId);
    await this.assertActiveContentTypes(input.blockedContentTypeIds);

    const { error: deleteError } = await client
      .from('parent_content_restrictions')
      .delete()
      .eq('parent_user_id', parentUserId)
      .eq('child_user_id', childUserId);

    if (deleteError) {
      throw new InternalServerErrorException(
        'Failed to clear existing parent content restrictions.',
      );
    }

    if (input.blockedContentTypeIds.length > 0) {
      const { error: insertError } = await client
        .from('parent_content_restrictions')
        .insert(
          input.blockedContentTypeIds.map((contentTypeId) => ({
            parent_user_id: parentUserId,
            child_user_id: childUserId,
            content_type_id: contentTypeId,
          })),
        );

      if (insertError) {
        throw new InternalServerErrorException(
          'Failed to save parent content restrictions.',
        );
      }
    }

    return this.getChildContentRestrictions(parentUserId, childUserId);
  }

  private async getParentLinkById(linkId: string) {
    const client = this.getClientOrThrow();

    const { data: link, error: linkError } = await client
      .from('parent_child_links')
      .select(
        'id, parent_user_id, child_user_id, relationship_status, linked_at, created_at, updated_at',
      )
      .eq('id', linkId)
      .maybeSingle();

    if (linkError) {
      throw new InternalServerErrorException(
        'Failed to load parent-child link.',
      );
    }

    if (!link) {
      throw new NotFoundException('Parent-child link was not found.');
    }

    const parsedLink = parentChildLinkRowSchema.safeParse(link);

    if (!parsedLink.success) {
      throw new InternalServerErrorException(
        'Parent-child link payload was invalid.',
      );
    }

    return parsedLink.data;
  }

  private async loadProfilesByIds(
    userIds: string[],
  ): Promise<Map<string, { username: string; accountType: AccountType }>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const client = this.getClientOrThrow();

    const { data: profileRows, error: profileError } = await client
      .from('profiles')
      .select('id, username, account_type')
      .in('id', userIds);

    if (profileError) {
      throw new InternalServerErrorException('Failed to load profile labels.');
    }

    const parsedProfiles = z
      .array(profileRowSchema)
      .safeParse(profileRows ?? []);

    if (!parsedProfiles.success) {
      throw new InternalServerErrorException(
        'Profile labels payload was invalid.',
      );
    }

    return new Map(
      parsedProfiles.data.map((profileRow) => [
        profileRow.id,
        {
          username: profileRow.username,
          accountType: profileRow.account_type,
        },
      ]),
    );
  }

  private mapParentLinkSummary(
    row: z.infer<typeof parentChildLinkRowSchema>,
    profileById: Map<string, { username: string; accountType: AccountType }>,
  ): ParentLinkSummary {
    const parentProfile = profileById.get(row.parent_user_id);
    const childProfile = profileById.get(row.child_user_id);

    if (!parentProfile || !childProfile) {
      throw new InternalServerErrorException(
        'Linked account profile was missing from profile map.',
      );
    }

    return {
      id: row.id,
      parentUserId: row.parent_user_id,
      parentUsername: parentProfile.username,
      childUserId: row.child_user_id,
      childUsername: childProfile.username,
      relationshipStatus: row.relationship_status,
      linkedAt: row.linked_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async listBlockedContentTypeIdsForPair(
    parentUserId: string,
    childUserId: string,
  ): Promise<string[]> {
    const client = this.getClientOrThrow();

    const { data: restrictionRows, error: restrictionError } = await client
      .from('parent_content_restrictions')
      .select('content_type_id')
      .eq('parent_user_id', parentUserId)
      .eq('child_user_id', childUserId);

    if (restrictionError) {
      throw new InternalServerErrorException(
        'Failed to load parent content restrictions for child.',
      );
    }

    const parsedRestrictionRows = z
      .array(parentContentRestrictionRowSchema)
      .safeParse(restrictionRows ?? []);

    if (!parsedRestrictionRows.success) {
      throw new InternalServerErrorException(
        'Stored parent content restriction payload was invalid.',
      );
    }

    return parsedRestrictionRows.data.map((row) => row.content_type_id);
  }

  private async assertParentChildLinkIsActive(
    parentUserId: string,
    childUserId: string,
  ): Promise<void> {
    const client = this.getClientOrThrow();

    const { data: link, error: linkError } = await client
      .from('parent_child_links')
      .select('id, relationship_status')
      .eq('parent_user_id', parentUserId)
      .eq('child_user_id', childUserId)
      .maybeSingle();

    if (linkError) {
      throw new InternalServerErrorException(
        'Failed to verify active parent-child link.',
      );
    }

    if (!link || link.relationship_status !== 'active') {
      throw new ForbiddenException(
        'An active parent-child link is required to manage this child account.',
      );
    }
  }

  private async assertAccountType(
    userId: string,
    expectedAccountType: Exclude<AccountType, 'admin'>,
  ): Promise<void> {
    const profile = await this.getProfileOrThrow(userId);

    if (profile.accountType !== expectedAccountType) {
      throw new ForbiddenException(
        `Only ${expectedAccountType} accounts can perform this action.`,
      );
    }
  }

  private async getProfileOrThrow(userId: string): Promise<{
    id: string;
    username: string;
    accountType: AccountType;
  }> {
    const client = this.getClientOrThrow();

    const { data: profileRow, error: profileError } = await client
      .from('profiles')
      .select('id, username, account_type')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException('Failed to load account profile.');
    }

    if (!profileRow) {
      throw new NotFoundException('Account profile was not found.');
    }

    const parsedProfile = profileRowSchema.safeParse(profileRow);

    if (!parsedProfile.success) {
      throw new InternalServerErrorException(
        'Account profile payload was invalid.',
      );
    }

    return {
      id: parsedProfile.data.id,
      username: parsedProfile.data.username,
      accountType: parsedProfile.data.account_type,
    };
  }

  private async assertActiveContentTypes(
    contentTypeIds: string[],
  ): Promise<void> {
    if (contentTypeIds.length === 0) {
      return;
    }

    const activeContentTypes = await this.contentService.listContentTypes();
    const activeContentTypeIdSet = new Set(
      activeContentTypes.map((contentType) => contentType.id),
    );

    const hasInactiveSelection = contentTypeIds.some(
      (contentTypeId) => !activeContentTypeIdSet.has(contentTypeId),
    );

    if (hasInactiveSelection) {
      throw new BadRequestException(
        'One or more restricted content types are invalid or inactive.',
      );
    }
  }

  private getClientOrThrow() {
    try {
      return this.supabaseService.getServiceClient();
    } catch {
      throw new ServiceUnavailableException(
        'Parent service is not configured yet. Set backend Supabase credentials.',
      );
    }
  }
}
