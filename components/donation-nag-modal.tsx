import {
  Animated,
  Linking,
  Modal,
  Platform,
  View,
} from 'react-native';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { DefaultText } from './default-text';
import { ButtonWithCenteredText } from './button/centered-text';
import { signedInUser } from '../App';
import { api } from '../api/api';
import { getRandomElement } from '../util/util';
import * as _ from "lodash";

const gagLocations = _.shuffle([
  '/a/',
  '/adv/',
  '/r9k/',
  '/v/',
  '@tinder on Twitter',
  'Bronies Anonymous',
  'Pornhub gooners',
  'Quora',
  'Re**it',
  'a 3-viewer Twitch chat',
  'a mongolian basket weaving forum',
  'a telemarketer',
  'a televangelist hotline',
  'annual cheese rolling event-goers',
  'boomers on Facebook',
  'chat',
  'goth girls at the local cemetery',
  'grandma',
  'jehovah’s witnesses',
  'my Ao3 readers',
  'my Discord server',
  'my Fortnite squad',
  'my Hinge matches',
  'my Letterboxd review readers',
  'my LinkedIn connections',
  'my Rabbi',
  'my TikTok followers',
  'my Tinder date',
  'my Twitch followers',
  'my Twitter oomfies',
  'my YouTube subscribers',
  'my autism support group',
  'my body pillow',
  'my cabal of BPD-having besties 😊',
  'my church',
  'my colleagues',
  'my cosplay convention',
  'my doctor',
  'my drunk uncle at Thanksgiving',
  'my femboy oomfies',
  'my flat earth society gathering',
  'my furry convention',
  'my imaginary friend',
  'my local renaissance faire',
  'my mom',
  'my parole officer',
  'my priest',
  'my silent meditation retreat',
  'my sleep paralysis demon',
  'my tax agent',
  'my therapist',
  'my weeb friends',
  'my wife’s boyfriend',
  'r/TwoXChromosomes',
  'r/UnexpectedJoJo',
  'r/bumble',
  'r/greentext',
  'r/wallstreetbets',
  'some gooners',
  'the NSA agent monitoring me',
  'the Neopets Revival Discord',
  'the Wendy’s drive-thru',
  'the antique typewriter convention',
  'the comic-con',
  'the fediverse',
  'the guy using the urinal next to mine',
  'the guy who hands out samples at Costco',
  'the guy who sells me vape juice',
  'the hand cuz the face ain’t listening',
  'the homeless gentleman outside my apartment',
  'the voices in my head',
  'you want I want, what I really really want',
]);

const DonationNagModal = () => {
  const name = signedInUser?.name;
  const estimatedEndDate = signedInUser?.estimatedEndDate;
  const doShowDonationNag = signedInUser?.doShowDonationNag;

  if (!name) return null;
  if (!estimatedEndDate) return null;
  if (!doShowDonationNag) return null;

  const props = { name, estimatedEndDate };

  if (Platform.OS === 'web') {
    return <DonationNagModalWeb { ...props } />;
  } else {
    return <DonationNagModalMobile { ...props } />;
  }
};

const DonationNagModalWeb = (props: {
  name: string
  estimatedEndDate: Date
}) => {
  if (Math.random() > 0.5) {
    return null;
  } else {
    return <MarketingDonationNagModalWeb {...props} />
  }
};

const MarketingDonationNagModalWeb = ({
  name,
  estimatedEndDate,
}: {
  name: string
  estimatedEndDate: Date
}) => {
  const [gagLocationIndex, setGagLocationIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  const gagLocation = gagLocations[gagLocationIndex % gagLocations.length];

  useEffect(() => {
    // Function to pick a random location with cross-fade animation
    const pickRandomLocation = () => {
      // Fade out the current text
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300, // Duration of fade-out
        useNativeDriver: true,
      }).start(() => {
        // After fade-out completes, update the location
        setGagLocationIndex((i) => i + 1);

        // Fade in the new text
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300, // Duration of fade-in
          useNativeDriver: true,
        }).start();
      });
    };

    const intervalId = setInterval(pickRandomLocation, 3000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [opacity]);

  const onPressButton = () => {
    setIsVisible(false);
    api('post', '/dismiss-donation');
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      statusBarTranslucent={true}
    >
      <View
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
        }}
      >
        <View
          style={{
            flex: 1,
            maxWidth: 600,
            margin: 10,
            backgroundColor: 'white',
            borderRadius: 5,
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              backgroundColor: '#70f',
              padding: 10,
              gap: 10,
            }}
          >
            <DefaultText
              style={{
                fontSize: 22,
                fontWeight: 900,
                textAlign: 'center',
                color: 'white',
              }}
            >
              Attention all terminally online degenerates!
            </DefaultText>

            <View
              style={{
                opacity: 0.9,
                gap: 10,
              }}
            >
              <DefaultText
                style={{
                  color: 'white',
                  textAlign: 'center',
                }}
              >
                <DefaultText style={{ fontWeight: '700' }}>
                  Want Duolicious to stay free?
                </DefaultText>
                {} You’re gonna need to do some shilling...
              </DefaultText>
            </View>
          </View>

          <View
            style={{
              gap: 10,
              paddingHorizontal: 10,
              paddingVertical: 20,
            }}
          >
            <DefaultText
              style={{
                textAlign: 'center',
              }}
            >
              Duolicious’ choice to be 100% free and volunteer-run means we
              can’t afford paid shills like big apps can. That means {}
              <DefaultText style={{ fontWeight: '700' }} >
                edgy shitposters like you
              </DefaultText>
              {} need to shill Duolicious to keep the new members coming. {}
              <DefaultText style={{ fontWeight: '700' }} >
                Please mention us wherever you lurk.
              </DefaultText>
            </DefaultText>
          </View>

          <View
            style={{
              padding: 10,
              paddingTop: 0,
            }}
          >
            <ButtonWithCenteredText
              onPress={onPressButton}
              extraChildren={
                <Animated.View
                  style={{
                    opacity: opacity,
                  }}
                >
                  <DefaultText
                    style={{
                      fontWeight: '700',
                      color: 'white',
                      fontSize: 16,
                      textAlign: 'center',
                      paddingHorizontal: 10,
                    }}
                  >
                    Ok, I’ll tell {gagLocation}
                  </DefaultText>
                </Animated.View>
              }
            />

            <ButtonWithCenteredText
              onPress={onPressButton}
              secondary={true}
              textStyle={{
                fontWeight: '700',
                paddingHorizontal: 10,
              }}
            >
              Just plaster this shithole with ads already
            </ButtonWithCenteredText>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const DonationNagModalMobile = ({
  name,
  estimatedEndDate,
}: {
  name: string
  estimatedEndDate: Date
}) => {
  return null;
};

const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const doUpdate = () => {
    const currentTime = new Date().getTime();
    const targetTime = targetDate.getTime();
    const difference = targetTime - currentTime;

    if (difference <= 0) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    } else {
      let days = Math.floor(difference / (1000 * 60 * 60 * 24));
      let hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      let minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      let seconds = Math.floor((difference % (1000 * 60)) / 1000);

      // Stop at 1 day
      if (days === 0) {
        days = 1;
        hours = 0;
        minutes = 0;
        seconds = 0;
      }

      setTimeLeft({ days, hours, minutes, seconds });
    }
  };

  useEffect(() => {
    doUpdate();

    const intervalId = setInterval(doUpdate, 1000);

    return () => clearInterval(intervalId);
  }, [targetDate]);

  // Helper function to format singular/plural
  const formatTime = (value, unit) => {
    return `${value} ${unit}${value !== 1 ? 's' : ''}`;
  };

  return (
    <View
      style={{
        opacity: 0.9,
        gap: 10,
      }}
    >
      <DefaultText
        style={{
          color: 'white',
          textAlign: 'center',
        }}
      >
        Duolicious will shut down in
      </DefaultText>
      <DefaultText
        style={{
          fontWeight: 700,
          textAlign: 'center',
          color: 'white',
        }}
      >
        {formatTime(timeLeft.days, 'day')}, {formatTime(timeLeft.hours, 'hr')}, {formatTime(timeLeft.minutes, 'min')}, {formatTime(timeLeft.seconds, 'sec')}
      </DefaultText>
      <DefaultText
        style={{
          color: 'white',
          textAlign: 'center',
        }}
      >
        without enough donations
      </DefaultText>
    </View>
  );
};

export {
  DonationNagModal,
};
