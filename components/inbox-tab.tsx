import {
  ListRenderItemInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TopNavBar } from './top-nav-bar';
import { IntrosItem, ChatsItem } from './inbox-item';
import { DefaultText } from './default-text';
import { ButtonGroup } from './button-group';
import { Notice } from './notice';
import { OptionScreen } from './option-screen';
import { hideMeFromStrangersOptionGroup } from '../data/option-groups';
import { DefaultFlatList } from './default-flat-list';
import { Inbox, Conversation, inboxStats, observeInbox } from '../xmpp/xmpp';
import { compareArrays } from '../util/util';
import { TopNavBarButton } from './top-nav-bar-button';
import { inboxOrder, inboxSection } from '../kv-storage/inbox';
import { signedInUser } from '../App';

const Stack = createNativeStackNavigator();

const IntrosItemMemo = memo(IntrosItem);
const ChatsItemMemo = memo(ChatsItem);

const InboxTab = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Inbox Tab" component={InboxTab_} />
      <Stack.Screen name="Inbox Option Screen" component={OptionScreen} />
    </Stack.Navigator>
  );
};

const InboxTab_ = ({navigation}) => {
  const maxIntros = 20;

  const [sectionIndex, setSectionIndex] = useState(0);
  const [sortByIndex, setSortByIndex] = useState(0);
  const [isTooManyTapped, setIsTooManyTapped] = useState(false);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const listRef = useRef<any>(undefined);

  const _inboxStats = inbox ? inboxStats(inbox) : null;

  const numUnreadChats  = _inboxStats?.numUnreadChats  ?? 0;
  const numUnreadIntros = _inboxStats?.numUnreadIntros ?? 0;
  const numIntros       = _inboxStats?.numIntros       ?? 0;

  const isIntrosTruncated = numIntros > maxIntros;
  const isUnreadIntrosTruncated = numUnreadIntros > maxIntros;
  const numUnreadIntrosTruncated = Math.min(numUnreadIntros, maxIntros);

  const introsTruncationLabel = isUnreadIntrosTruncated ? '+' : '';

  const introsNumericalLabel = (
    numUnreadIntrosTruncated ?
      ` (${numUnreadIntrosTruncated}${introsTruncationLabel})` :
      '');
  const chatsNumericalLabel = (
    numUnreadChats  ?
    ` (${numUnreadChats})` :
    '');

  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const fadeOut = useCallback(() => {
    Animated.timing(buttonOpacity, {
      toValue: 0.0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  const fadeIn = useCallback(() => {
    Animated.timing(buttonOpacity, {
      toValue: 1.0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);

  const setSectionIndex_ = useCallback((value: number) => {
    setSectionIndex(value);
    inboxSection(value);
  }, []);
  const setSortByIndex_  = useCallback((value: number) => {
    setSortByIndex(value);
    inboxOrder(value);
  }, []);

  const onPressTooMany = useCallback(() => {
    navigation.navigate(
      'Inbox Option Screen',
      {
        optionGroups: [hideMeFromStrangersOptionGroup],
      }
    );
    setIsTooManyTapped(true);
  }, []);

  const onPressArchiveButton = useCallback(() => {
    setShowArchive(x => !x);
  }, []);

  const maybeRefresh = useCallback(() => {
    listRef.current?.refresh && listRef.current.refresh()
  }, [listRef]);

  useEffect(() => {
    (async () => {
      const _inboxOrder = await inboxOrder();
      const _inboxSection = await inboxSection();

      setSectionIndex(_inboxSection);
      setSortByIndex(_inboxOrder);

      observeInbox(setInbox);
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

    const section = (() => {
      switch (sectionName) {
        case 'chats':   return inbox.chats;
        case 'intros':  return inbox.intros;
        case 'archive': return inbox.archive;
      }
    })();

    const pageSize = 10;
    const page = section
      .conversations
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
      })
      .slice(
        0,
        sectionName === 'intros' ? maxIntros : section.conversations.length
      )
      .slice(
        pageSize * (n - 1),
        pageSize * n
      );

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
        'to you first – Once you reply, they’ll move to your Chats 🗨️'
      );
    if (!showArchive && sectionIndex === 1)
      return (
        'This is where you’ll see active conversations – Chats start once ' +
        'both people have exchanged messages 💬'
      );
    if (showArchive)
      return 'No archived conversations to show';
    throw Error('Unhandled inbox section');
  })();

  const endText = (() => {
    if (!showArchive && sectionIndex === 0 && isIntrosTruncated)
      return (
        `You have more intros! Skip or reply to your top ${maxIntros} intros ` +
        'to see the rest'
      );
    if (!showArchive && sectionIndex === 0 && !isIntrosTruncated)
      return 'Those are all the intros you have for now';
    if (!showArchive && sectionIndex === 1)
      return 'No more chats to show';
    if (showArchive)
      return 'No more archived conversations to show';
    throw Error('Unhandled inbox section');
  })();

  const ListHeaderComponent = () => {
    useEffect(() => {
      if (sectionIndex === 0) {
        fadeIn();
      } else {
        fadeOut();
      }
    }, [sectionIndex]);

    return (
      <>
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
        <Animated.View
          style={{
            opacity: buttonOpacity,
          }}
          pointerEvents={sectionIndex === 1 ? 'none' : 'auto'}
        >
          <ButtonGroup
            buttons={['Best Matches First', 'Latest First']}
            selectedIndex={sortByIndex}
            onPress={setSortByIndex_}
            secondary={true}
            containerStyle={{
              flexGrow: 1,
              marginLeft: 20,
              marginRight: 20,
            }}
          />
        </Animated.View>
        {sectionIndex === 1 && signedInUser && signedInUser.personId < 7741 &&
          <Notice>
            <DefaultText style={{color: '#70f', fontWeight: '700'}} >
              Update
              <DefaultText style={{fontWeight: '400'}}>
                {} – Conversations now only appear in your Chats once you get a
                reply
              </DefaultText>
            </DefaultText>
          </Notice>
        }
      </>
    );
  };

  const renderItem = useCallback((x: ListRenderItemInfo<Conversation>) => {
    if (sectionIndex === 0 && !showArchive) {
      return <IntrosItemMemo
        wasRead={x.item.lastMessageRead}
        name={x.item.name}
        personId={x.item.personId}
        imageUuid={x.item.imageUuid}
        matchPercentage={x.item.matchPercentage}
        lastMessage={x.item.lastMessage}
        lastMessageTimestamp={x.item.lastMessageTimestamp}
        isAvailableUser={x.item.isAvailableUser}
      />
    } else {
      return <ChatsItemMemo
        wasRead={x.item.lastMessageRead}
        name={x.item.name}
        personId={x.item.personId}
        imageUuid={x.item.imageUuid}
        matchPercentage={x.item.matchPercentage}
        lastMessage={x.item.lastMessage}
        lastMessageTimestamp={x.item.lastMessageTimestamp}
        isAvailableUser={x.item.isAvailableUser}
      />
    }
  }, [sectionIndex, showArchive]);

  return (
    <>
      <TopNavBar>
        <DefaultText
          style={{
            fontWeight: '700',
            fontSize: 20,
          }}
        >
          {'Inbox' + (showArchive ? ' (Archive)' : '')}
        </DefaultText>
        <TopNavBarButton
          onPress={onPressArchiveButton}
          iconName={showArchive ? 'chatbubbles-outline' : 'file-tray-full-outline'}
          style={{right: 15}}
        />
      </TopNavBar>
      {inbox === null &&
        <View style={{height: '100%', justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#70f" />
        </View>
      }
      {inbox !== null &&
        <DefaultFlatList
          ref={listRef}
          emptyText={emptyText}
          endText={endText}
          fetchPage={fetchPage}
          dataKey={JSON.stringify({showArchive, sectionIndex})}
          ListHeaderComponent={showArchive ? undefined : ListHeaderComponent}
          renderItem={renderItem}
          disableRefresh={true}
        />
      }
    </>
  );
};

export default InboxTab;
