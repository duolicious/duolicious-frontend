import { useEffect, useState } from 'react';
import { compareArrays } from '../../../util/util';
import { Inbox, Conversation } from '../index';
import { listen, lastEvent } from '../../../events/events';
import * as _ from 'lodash';

/**
 * React hook that returns the list of `personUuid`s for the conversations
 * that belong to the requested inbox section. The list is memoised so that
 * the reference will only change when the ordering or membership actually
 * changes – this helps to minimise re-renders of parent components that pass
 * the list directly to a `FlatList`.
 *
 * @param section   Which sub-section of the inbox to return ("intros",
 *                  "chats" or "archive").
 * @param sortBy    Sorting preference index; mirrors the logic from the
 *                  original implementation in `components/inbox-tab.tsx`.
 */
const getSectionConversations = (
  inbox: Inbox | null,
  section: 'intros' | 'chats' | 'archive',
): Conversation[] => {
  if (!inbox) return [];

  switch (section) {
    case 'intros':  return inbox.intros.conversations;
    case 'chats':   return inbox.chats.conversations;
    case 'archive': return inbox.archive.conversations;
    default:        return [];
  }
};

const sortConversations = (
  conversations: Conversation[],
  section: 'intros' | 'chats' | 'archive',
  sortBy: 'latest' | 'match',
): Conversation[] => {
  if (conversations.length === 0) return conversations;

  return [...conversations].sort((a, b) => {
    if (section === 'archive') {
      return compareArrays([
        +b.lastMessageTimestamp,
      ], [
        +a.lastMessageTimestamp,
      ]);
    } else if (section === 'intros' && sortBy === 'match') {
      return compareArrays(
        [b.matchPercentage, +b.lastMessageTimestamp],
        [a.matchPercentage, +a.lastMessageTimestamp],
      );
    } else {
      return compareArrays(
        [+b.lastMessageTimestamp, b.matchPercentage],
        [+a.lastMessageTimestamp, a.matchPercentage],
      );
    }
  });
};

const computeConversationIds = (
  inbox: Inbox | null,
  section: 'intros' | 'chats' | 'archive',
  sortBy: 'latest' | 'match'
): string[] | null => {
  if (inbox === null) {
    return null;
  }

  const conversations = getSectionConversations(inbox, section);
  const sorted = sortConversations(conversations, section, sortBy);
  return sorted.map((c) => c.personUuid);
};

const useConversations = (
  section: 'intros' | 'chats' | 'archive',
  sortBy: 'latest' | 'match'
): string[] | null => {
  // Initial value derived synchronously from the last known inbox.
  const initialIds = computeConversationIds(
    lastEvent<Inbox | null>('inbox') ?? null,
    section,
    sortBy,
  );

  const [conversationIds, setConversationIds] = useState<string[] | null>(initialIds);

  // Subscribe to inbox updates and update only when the derived list changes.
  useEffect(() => {
    const update = (newInbox?: Inbox | null) => {
      const newIds = computeConversationIds(newInbox ?? null, section, sortBy);
      setConversationIds((prevIds) =>
        _.isEqual(prevIds, newIds) ? prevIds : newIds
      );
    };

    return listen<Inbox | null>('inbox', update, true);
  }, [section, sortBy]);

  return conversationIds;
};

export { useConversations };
