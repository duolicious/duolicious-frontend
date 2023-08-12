import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ButtonForOption } from './button/option';
import { DuoliciousTopNavBar } from './top-nav-bar';
import { OptionScreen } from './option-screen';
import { Title } from './title';
import { DefaultLongTextInput } from './default-long-text-input';
import {
  OptionGroup,
  OptionGroupPhotos,
  basicsOptionGroups,
  deactivationOptionGroups,
  deletionOptionGroups,
  generalSettingsOptionGroups,
  getDefaultValue,
  isOptionGroupButtons,
  isOptionGroupLocationSelector,
  isOptionGroupSlider,
  notificationSettingsOptionGroups,
  privacySettingsOptionGroups,
} from '../data/option-groups';
import { Images } from './images';
import { DefaultText } from './default-text';
import { sessionToken } from '../kv-storage/session-token';
import { api, mapi, japi } from '../api/api';
import { setSignedInUser } from '../App';
import {
  IMAGES_URL,
} from '../env/env';
import { cmToFeetInchesStr } from '../units/units';
import { signedInUser } from '../App';
import * as _ from "lodash";
import debounce from 'lodash/debounce';

// TODO: Needs a spinner when loading data

const Stack = createNativeStackNavigator();

const ProfileTab = ({navigation}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Profile Tab" component={ProfileTab_} />
      <Stack.Screen name="Profile Option Screen" component={OptionScreen} />
    </Stack.Navigator>
  );
};

const Images_ = ({data}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const input: OptionGroupPhotos = useMemo(() => {
    return {
      photos: {
        submit: async (filename, pathOrBase64) => (await mapi(
          'patch',
          '/profile-info',
          filename,
          pathOrBase64
        )).ok,
        delete: async (filename) => (await japi(
          'delete',
          '/profile-info',
          { files: [filename] }
        )).ok,
        fetch: async (position: string, resolution: string) => {
          const imageUuid = (data?.photo ?? {})[position] ?? null;
          if (imageUuid) {
            return `${IMAGES_URL}/${resolution}-${imageUuid}.jpg`
          } else {
            return null;
          }
        }
      }
    };
  }, [data]);

  return <Images
    input={input}
    setIsLoading={setIsLoading}
    setIsInvalid={setIsInvalid} />
};

const ProfileTab_ = ({navigation}) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const response = await api('get', '/profile-info');
      if (response.json) {
        setData(response.json);
      }
    })();
  }, []);

  return (
    <>
      <DuoliciousTopNavBar/>
      {data &&
        <ScrollView
          contentContainerStyle={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingBottom: 20,
            maxWidth: 600,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Title>Profile Pictures</Title>
          <Images_ data={data}/>
          <AboutPerson navigation={navigation} data={data}/>
          <Options navigation={navigation} data={data}/>
          <AboutDuolicious/>
        </ScrollView>
      }
      {!data &&
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
          }}
        >
          <ActivityIndicator size={60} color="#70f"/>
        </View>
      }
    </>
  );
};

const AboutPerson = ({navigation, data}) => {
  const [aboutState, setAboutState] = useState<
    'unchanged' | 'saving...' | 'saved' | 'error'
  >('unchanged');

  const debouncedOnChangeAboutText = useCallback(
    debounce(
      async (about: string, cb: (ok: boolean) => void) => {
        const response = await japi('patch', '/profile-info', { about });
        cb(response.ok);
      },
      1000,
    ),
    []
  );

  const onChangeAboutText = useCallback(async (about: string) => {
    setAboutState('saving...');
    await debouncedOnChangeAboutText(
      about,
      (ok) => setAboutState(ok ? 'saved' : 'error'),
    );
  }, []);

  return (
    <View>
      <Title>
        About {}
        {aboutState !== 'unchanged' &&
          <DefaultText
            style={{
              fontSize: 14,
              fontWeight: '400',
              color: '#777',
            }}
          >
            ({aboutState})
          </DefaultText>
        }
      </Title>
      <DefaultLongTextInput
        defaultValue={data?.about ?? ''}
        onChangeText={onChangeAboutText}
      />
    </View>
  );
};

const Options = ({navigation, data}) => {
  const [isLoadingSignOut, setIsLoadingSignOut] = useState(false);

  const addDefaultValue = (optionGroups: OptionGroup[]) =>
    optionGroups.map((og: OptionGroup, i: number): OptionGroup =>
      _.merge(
        {},
        og,
        isOptionGroupButtons(og.input) ? {
          input: {
            buttons: {
              defaultValue: (data ?? {})[optionGroups[i].title.toLowerCase()]
            }
          }
        } : {},
        isOptionGroupLocationSelector(og.input) ? {
          input: {
            locationSelector: {
              defaultValue: (data ?? {})[optionGroups[i].title.toLowerCase()]
            }
          }
        } : {},
        isOptionGroupSlider(og.input) && og.title === 'Height' ? {
          input: {
            slider: {
              unitsLabel: (
                signedInUser?.units === 'Imperial' ?
                "ft'in\"" : undefined),
              valueRewriter: (
                signedInUser?.units === 'Imperial' ?
                cmToFeetInchesStr : undefined),
              defaultValue: (data ?? {})[optionGroups[i].title.toLowerCase()] ?? 170
            }
          }
        } : {},
      )
    );

  const [
    _basicsOptionGroups,
    _generalSettingsOptionGroups,
    _notificationSettingsOptionGroups,
    _privacySettingsOptionGroups,
  ] = useMemo(
    () => [
      addDefaultValue(basicsOptionGroups),
      addDefaultValue(generalSettingsOptionGroups),
      addDefaultValue(notificationSettingsOptionGroups),
      addDefaultValue(privacySettingsOptionGroups),
    ],
    [data]
  );

  const Button_ = (props) => {
    return <ButtonForOption
      navigation={navigation}
      navigationScreen="Profile Option Screen"
      {...props}
    />;
  }

  const signOut = useCallback(async () => {
    setIsLoadingSignOut(true);
    if ((await api('post', '/sign-out')).ok) {
      await sessionToken(null);
      setSignedInUser(undefined);
    }
    setIsLoadingSignOut(false);
  }, [navigation]);

  return (
    <View>
      <Title>Basics</Title>
      {
        _basicsOptionGroups.map((_, i) =>
          <Button_
            key={i}
            setting={getDefaultValue(_basicsOptionGroups[i].input)}
            optionGroups={_basicsOptionGroups.slice(i)}
          />
        )
      }
      <Title>General Settings</Title>
      {
        _generalSettingsOptionGroups.map((_, i) =>
          <Button_
            key={i}
            setting={getDefaultValue(_generalSettingsOptionGroups[i].input)}
            optionGroups={_generalSettingsOptionGroups.slice(i)}
          />
        )
      }
      <Title>Notification Settings</Title>
      {
        _notificationSettingsOptionGroups.map((_, i) =>
          <Button_
            key={i}
            setting={getDefaultValue(_notificationSettingsOptionGroups[i].input)}
            optionGroups={_notificationSettingsOptionGroups.slice(i)}
          />
        )
      }
      <Title>Privacy Settings</Title>
      {
        _privacySettingsOptionGroups.map((_, i) =>
          <Button_
            key={i}
            setting={getDefaultValue(_privacySettingsOptionGroups[i].input)}
            optionGroups={_privacySettingsOptionGroups.slice(i)}
          />
        )
      }

      <Title>Sign Out</Title>
      <ButtonForOption
        onPress={signOut}
        label="Sign Out"
        setting=""
        loading={isLoadingSignOut}
      />

      <Title>Deactivate Your Account</Title>
      <Button_ optionGroups={deactivationOptionGroups} setting="" showSkipButton={false}/>

      <Title>Delete Your Account</Title>
      <Button_ optionGroups={deletionOptionGroups} setting=""/>
    </View>
  );
};

const AboutDuolicious = () => {
  return (
    <View>
      <Title style={{marginTop: 40, textAlign: 'center', color: '#999'}}>About</Title>
      <Pressable
        onPress={() => Linking.openURL('https://github.com/duolicious')}
      >
        <DefaultText
          style={{
            textAlign: 'center',
            color: '#999',
          }}
        >
          Duolicious is free software licensed under the AGPLv3. The source code
          used to make Duolicious is available {}
          <DefaultText style={{fontWeight: '600', color: '#37f'}}>
            here
          </DefaultText>
          .
        </DefaultText>
      </Pressable>
      <Pressable
        style={{marginTop: 15}}
        onPress={() => Linking.openURL('mailto:support@duolicious.app')}
      >
        <DefaultText
          style={{
            textAlign: 'center',
            color: '#999',
          }}
        >
          You can contact us at {}
          <DefaultText style={{fontWeight: '600', color: '#37f'}}>
            support@duolicious.app
          </DefaultText>
          {} to provide feedback, report abuse, or submit any other concerns or
          queries you have.
        </DefaultText>
      </Pressable>
    </View>
  );
};

export default ProfileTab;
