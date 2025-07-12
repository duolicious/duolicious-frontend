import {
  ListRenderItemInfo,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  View,
} from 'react-native';
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { TopNavBar } from './top-nav-bar';
import { IntrosItem, ChatsItem } from './inbox-item';
import { DefaultText } from './default-text';
import { ButtonGroup } from './button-group';
import { DefaultFlatList } from './default-flat-list';
import { Conversation, inboxStats } from '../chat/application-layer';
import { useInbox } from '../chat/application-layer/hooks/inbox';
import { compareArrays } from '../util/util';
import { TopNavBarButton } from './top-nav-bar-button';
import { inboxOrder, inboxSection } from '../kv-storage/inbox';
import { listen } from '../events/events';
import { useScrollbar } from './navigation/scroll-bar-hooks';


const IntrosItemMemo = memo(IntrosItem);
const ChatsItemMemo = memo(ChatsItem);

const InboxTab = () => {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [sortByIndex, setSortByIndex] = useState(0);
  const inbox = useInbox();
  const [showArchive, setShowArchive] = useState(false);
  const listRef = useRef<any>(undefined);

  const _inboxStats = inbox ? inboxStats(inbox) : null;

  const numUnreadIntros = _inboxStats?.numUnreadIntros ?? 0;
  const numUnreadChats  = _inboxStats?.numUnreadChats  ?? 0;

  const introsNumericalLabel = (
    numUnreadIntros ?
      ` (${numUnreadIntros})` :
      '');
  const chatsNumericalLabel = (
    numUnreadChats  ?
    ` (${numUnreadChats})` :
    '');

  const setSectionIndex_ = useCallback((value: number) => {
    setSectionIndex(value);
    inboxSection(value);
  }, []);
  const setSortByIndex_  = useCallback((value: number) => {
    setSortByIndex(value);
    inboxOrder(value);
  }, []);

  const onPressArchiveButton = useCallback(() => {
    setShowArchive(x => !x);
  }, []);

  const maybeRefresh = useCallback(() => {
    listRef.current?.refresh && listRef.current.refresh();
  }, [listRef]);

  // Listening for inbox updates is now handled inside useInbox

  useEffect(() => {
    (async () => {
      const _inboxOrder = await inboxOrder();
      const _inboxSection = await inboxSection();

      setSectionIndex(_inboxSection);
      setSortByIndex(_inboxOrder);
    })();
  }, []);

  useEffect(maybeRefresh, [maybeRefresh, sectionIndex]);
  useEffect(maybeRefresh, [maybeRefresh, sortByIndex]);
  useEffect(maybeRefresh, [maybeRefresh, inbox]);
  useEffect(maybeRefresh, [maybeRefresh, showArchive]);

  const fetchInboxPage = (
    sectionName: 'chats' | 'intros' | 'archive'
  ) => async (
    n: number
  ): Promise<Conversation[]> => {
    if (inbox === null) {
      return [];
    }

    if (n >= 2) {
      return [];
    }

    const section = (() => {
      switch (sectionName) {
        case 'chats':   return inbox.chats;
        case 'intros':  return inbox.intros;
        case 'archive': return inbox.archive;
      }
    })();

    const page = [...section.conversations]
      .sort((a, b) => {
        if (sectionName === 'archive') {
          return compareArrays(
            [+b.lastMessageTimestamp],
            [+a.lastMessageTimestamp],
          );
        } else if (sectionName === 'intros' && sortByIndex === 0) {
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

    return page;
  };

  const fetchChatsPage   = fetchInboxPage('chats');
  const fetchIntrosPage  = fetchInboxPage('intros');
  const fetchArchivePage = fetchInboxPage('archive');

  const fetchPage = (() => {
    if (!showArchive && sectionIndex === 0)
      return fetchIntrosPage;
    if (!showArchive && sectionIndex === 1)
      return fetchChatsPage;
    if (showArchive)
      return fetchArchivePage;
    throw Error('Unhandled inbox section');
  })();

  const emptyText = (() => {
    if (!showArchive && sectionIndex === 0)
      return (
        'This is where you’ll see messages from people who’ve reached out ' +
        'to you first – Once you reply, they’ll move to your Chats\xa0💬'
      );
    if (!showArchive && sectionIndex === 1)
      return (
        'This is where you’ll see active conversations – Chats start once ' +
        'both people have exchanged messages\xa0💬'
      );
    if (showArchive)
      return 'No archived conversations to show';
    throw Error('Unhandled inbox section');
  })();

  const endText = (() => {
    if (showArchive) {
      return 'No more archived conversations to show';
    } else {
      if (sectionIndex === 0) {
        return 'Those are all the intros you have for now';
      } else {
        return 'No more chats to show';
      }
    }
  })();

  const renderItem = useCallback((x: ListRenderItemInfo<Conversation>) => {
    if (sectionIndex === 0 && !showArchive) {
      return <IntrosItemMemo personUuid={x.item.personUuid} />
    } else {
      return <ChatsItemMemo personUuid={x.item.personUuid} />
    }
  }, [sectionIndex, showArchive]);

  const keyExtractor = useCallback((c: Conversation) => c.personUuid, []);

  const {
    onLayout,
    onContentSizeChange,
    onScroll,
    showsVerticalScrollIndicator,
    observeListRef,
  } = useScrollbar('inbox');

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <InboxTabNavBar
        showArchive={showArchive}
        onPressArchiveButton={onPressArchiveButton}
      />
      {inbox === null &&
        <View style={{height: '100%', justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#70f" />
        </View>
      }
      {inbox !== null &&
        <DefaultFlatList
          ref={listRef}
          innerRef={observeListRef}
          emptyText={emptyText}
          endText={endText}
          fetchPage={fetchPage}
          dataKey={JSON.stringify({showArchive, sectionIndex})}
          ListHeaderComponent={<>{
            !showArchive && <>
              <ButtonGroup
                buttons={[
                  'Intros' + introsNumericalLabel,
                  'Chats'  + chatsNumericalLabel
                ]}
                selectedIndex={sectionIndex}
                onPress={setSectionIndex_}
                containerStyle={{
                  marginTop: 5,
                  marginLeft: 20,
                  marginRight: 20,
                }}
              />
              <ButtonGroup
                buttons={['Best Matches First', 'Latest First']}
                selectedIndex={sortByIndex}
                onPress={setSortByIndex_}
                secondary={true}
                disabled={sectionIndex === 1}
                containerStyle={{
                  flexGrow: 1,
                  marginLeft: 20,
                  marginRight: 20,
                }}
              />
            </>
          }</>}
          hideListHeaderComponentWhenLoading={false}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          disableRefresh={true}
          onLayout={onLayout}
          onContentSizeChange={onContentSizeChange}
          onScroll={onScroll}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        />
      }
    </SafeAreaView>
  );
};

const InboxTabNavBar = ({
  showArchive,
  onPressArchiveButton,
}) => {
  const [isOnline, setIsOnline] = useState(false);

  useLayoutEffect(() => {
    return listen(
      'xmpp-is-online',
      (data) => setIsOnline(data ?? false),
      true,
    );
  }, []);

  return (
    <TopNavBar>
      <View>
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          {'Inbox' + (showArchive ? ' (Archive)' : '')}
        </DefaultText>
        {!isOnline &&
          <ActivityIndicator
            size="small"
            color="#70f"
            style={{
              position: 'absolute',
              right: -40,
              top: 3,
            }}
          />
        }
      </View>
      <TopNavBarButton
        onPress={onPressArchiveButton}
        iconName={showArchive ? 'chatbubbles-outline' : 'file-tray-full-outline'}
        position="right"
        secondary={false}
        label={showArchive ? "Inbox" : "Archive"}
      />
    </TopNavBar>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  }
});

export { InboxTab };
