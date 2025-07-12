import { useLayoutEffect, useState } from 'react';
import { Conversation, Inbox } from '../index';
import { listen, lastEvent } from '../../../events/events';

/**
 * Returns the up-to-date Conversation object for the given personUuid.
 * Internally this hook subscribes to the inbox via `useInbox` and derives the
 * conversation from there, so whenever the inbox changes only the components
 * that depend on the specific conversation will re-render.
 */
const useConversation = (personUuid: string): Conversation | null => {
  // Initialise with the current conversation (if any)
  const getConversationFromInbox = (inbox: Inbox | null): Conversation | null => {
    if (!inbox) return null;

    return (
      inbox.chats.conversationsMap[personUuid] ??
      inbox.intros.conversationsMap[personUuid] ??
      inbox.archive.conversationsMap[personUuid] ??
      null
    );
  };

  const [conversation, setConversation] = useState<Conversation | null>(
    getConversationFromInbox(lastEvent<Inbox | null>('inbox') ?? null)
  );

  // Subscribe to inbox updates and only update local state when the specific
  // conversation actually changes (reference equality).
  useLayoutEffect(() => {
    return listen<Inbox | null>('inbox', (newInbox) => {
      const newConv = getConversationFromInbox(newInbox ?? null);

      // Only update state if the reference differs (i.e., this conversation was
      // actually updated) to avoid unnecessary re-renders.
      if (newConv !== conversation) {
        setConversation(newConv);
      }
    });
  }, [personUuid, conversation]);

  return conversation;
};

export { useConversation }; 