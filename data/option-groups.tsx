import * as _ from "lodash";
import { api, japi, ApiResponse } from '../api/api';
import { setSignedInUser, navigationContainerRef } from '../App';
import { sessionToken, sessionPersonUuid } from '../kv-storage/session-token';
import { X } from "react-native-feather";
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faPalette } from '@fortawesome/free-solid-svg-icons/faPalette'
import { faRulerVertical } from '@fortawesome/free-solid-svg-icons/faRulerVertical'
import { faRuler } from '@fortawesome/free-solid-svg-icons/faRuler'
import { faHandsPraying } from '@fortawesome/free-solid-svg-icons/faHandsPraying'
import { faPills } from '@fortawesome/free-solid-svg-icons/faPills'
import { faSmoking } from '@fortawesome/free-solid-svg-icons/faSmoking'
import { faVenusMars } from '@fortawesome/free-solid-svg-icons/faVenusMars'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane'
import { faLocationDot } from '@fortawesome/free-solid-svg-icons/faLocationDot'
import { faImage } from '@fortawesome/free-solid-svg-icons/faImage'
import { faCalendar } from '@fortawesome/free-solid-svg-icons/faCalendar'
import { faPeopleGroup } from '@fortawesome/free-solid-svg-icons/faPeopleGroup'
import Ionicons from '@expo/vector-icons/Ionicons';
import { NonNullImageCropperOutput } from '../components/image-cropper';
import { login, logout } from '../xmpp/xmpp';
import { LOGARITHMIC_SCALE, Scale } from "../scales/scales";
import { VerificationBadge } from '../components/verification-badge';
import { VerificationEvent } from '../verification/verification';
import { notify, lastEvent } from '../events/events';
import { ClubItem } from '../club/club';
import { DefaultText } from '../components/default-text';
import {
  Linking,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { FC } from 'react';
import { onboardingQueue } from '../api/queue';
import {
  cmToLocaleUnitsStr,
  cmToLocaleStr,
  kmToLocaleUnitsStr,
  kmToLocaleStr,
} from '../units/units';

const noneFontSize = 16;

const maxDailySelfies = 'eight';

const descriptionStyle = StyleSheet.create({
  style: {
    color: '#777',
    textAlign: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 10,
  }
});

type OptionGroupButtons = {
  buttons: {
    values: string[],
    submit: (input: string) => Promise<boolean>
    currentValue?: string,
  }
};


type OptionGroupLocationSelector = {
  locationSelector: {
    submit: (input: string) => Promise<boolean>
    currentValue?: string,
  }
};

type OptionGroupGivenName = {
  givenName: {
    submit: (input: string) => Promise<boolean>
  }
};

type OptionGroupDate = {
  date: {
    submit: (input: string) => Promise<boolean>
  }
};

type OptionGroupPhotos = {
  photos: {
    submit: (position: number, cropperOutput: NonNullImageCropperOutput) => Promise<boolean>
    submitAll?: () => Promise<ApiResponse>
    delete: (filename: string) => Promise<boolean>
    getUri?: (position: string, resolution: string) => string | null
    getBlurhash?: (position: string) => string | null
    showProtip?: boolean,
    validateAtLeastOne?: boolean,
    firstFileNumber?: number,
  }
};

type OptionGroupTextLong = {
  textLong: {
    submit: (input: string) => Promise<boolean>
    invalidMsg?: string
  }
};

type OptionGroupTextShort = {
  textShort: {
    submit: (input: string) => Promise<boolean>
    currentValue?: string,
    invalidMsg?: string
  }
};

type OptionGroupOtp = {
  otp: {
    submit: (input: string) => Promise<boolean>
  }
};

type OptionGroupCheckChips = {
  checkChips: {
    values: {
      label: string
      checked: boolean
    }[]
    submit: (input: string[]) => Promise<boolean>
  }
};

type OptionGroupVerificationChecker = {
  verificationChecker: {}
};

type OptionGroupThemePicker = {
  themePicker: {
    currentTitleColor?: string,
    currentBodyColor?: string,
    currentBackgroundColor?: string,
    submit: (
      titleColor: string,
      bodyColor: string,
      backgroundColor: string
    ) => Promise<boolean>,
  }
};

type OptionGroupNone = {
  none: {
    description?: string | FC,
    textAlign?: "left" | "right" | "auto" | "center" | "justify",
    submit: () => Promise<boolean>
  }
};

type OptionGroupSlider = {
  slider: {
    sliderMin: number,
    sliderMax: number,
    step: number,
    unitsLabel: () => string,
    submit: (input: number | null) => Promise<boolean>,
    addPlusAtMax?: boolean,
    defaultValue: number,
    valueRewriter?: (v: number) => string,
    currentValue?: number,
    scale?: Scale,
  }
};

type OptionGroupRangeSlider = {
  rangeSlider: {
    sliderMin: number,
    sliderMax: number,
    unitsLabel: () => string,
    submit: (sliderMin: number | null, sliderMax: number | null) => Promise<boolean>,
    valueRewriter?: (v: number) => string,
    currentMin?: number,
    currentMax?: number,
    scale?: Scale,
  }
};

type OptionGroupInputs
  = OptionGroupButtons
  | OptionGroupLocationSelector
  | OptionGroupSlider
  | OptionGroupRangeSlider
  | OptionGroupGivenName
  | OptionGroupDate
  | OptionGroupPhotos
  | OptionGroupTextLong
  | OptionGroupTextShort
  | OptionGroupOtp
  | OptionGroupCheckChips
  | OptionGroupVerificationChecker
  | OptionGroupThemePicker
  | OptionGroupNone;

type OptionGroup<T extends OptionGroupInputs> = {
  title: string,
  Icon?: any,
  description: string | FC,
  input: T,
  scrollView?: boolean,
  buttonLabel?: string,
};

const hasExactKeys = (obj, keys) => {
    // If the number of keys in the object and the keys array don't match, return false
    if (Object.keys(obj).length !== keys.length) return false;

    // Check whether each key in the keys array exists in the object
    for (let i = 0; i < keys.length; i++) {
        if (!obj.hasOwnProperty(keys[i])) return false;
    }

    // If all keys are found, return true
    return true;
}

const isOptionGroupButtons = (x: any): x is OptionGroupButtons => {
  return hasExactKeys(x, ['buttons']);
}

const isOptionGroupLocationSelector = (x: any): x is OptionGroupLocationSelector => {
  return hasExactKeys(x, ['locationSelector']);
}

const isOptionGroupSlider = (x: any): x is OptionGroupSlider => {
  return hasExactKeys(x, ['slider']);
};

const isOptionGroupRangeSlider = (x: any): x is OptionGroupRangeSlider => {
  return hasExactKeys(x, ['rangeSlider']);
}

const isOptionGroupGivenName = (x: any): x is OptionGroupGivenName => {
  return hasExactKeys(x, ['givenName']);
}

const isOptionGroupDate = (x: any): x is OptionGroupDate => {
  return hasExactKeys(x, ['date']);
}

const isOptionGroupPhotos = (x: any): x is OptionGroupPhotos => {
  return hasExactKeys(x, ['photos']);
}

const isOptionGroupTextLong = (x: any): x is OptionGroupTextLong => {
  return hasExactKeys(x, ['textLong']);
}

const isOptionGroupTextShort = (x: any): x is OptionGroupTextShort => {
  return hasExactKeys(x, ['textShort']);
}

const isOptionGroupOtp = (x: any): x is OptionGroupOtp => {
  return hasExactKeys(x, ['otp']);
}

const isOptionGroupVerificationChecker = (x: any): x is OptionGroupVerificationChecker => {
  return hasExactKeys(x, ['verificationChecker']);
}

const isOptionGroupThemePicker = (x: any): x is OptionGroupThemePicker => {
  return hasExactKeys(x, ['themePicker']);
}

const isOptionGroupNone = (x: any): x is OptionGroupNone => {
  return hasExactKeys(x, ['none']);
}

const isOptionGroupCheckChips = (x: any): x is OptionGroupCheckChips => {
  return hasExactKeys(x, ['checkChips']);
}

// TODO: Check where this is called and use events instead
const getCurrentValue = (x: OptionGroupInputs | undefined) => {
  if (isOptionGroupButtons(x))
    return x.buttons.currentValue;

  if (isOptionGroupLocationSelector(x))
    return x.locationSelector.currentValue;

  if (isOptionGroupTextShort(x))
    return x.textShort.currentValue;

  if (isOptionGroupSlider(x))
    return x.slider.currentValue;

  if (isOptionGroupRangeSlider(x))
    return {
      sliderMin: x.rangeSlider.sliderMin,
      sliderMax: x.rangeSlider.sliderMax,
    };

  if (isOptionGroupCheckChips(x))
    return x.checkChips.values.flatMap((v) => v.checked ? [v.label] : []);
}

const eventName = (
  endpoint: '/profile-info' | '/search-filter',
  titleOrKey: string,
) => {
  return endpoint + ' ' + titleOrKey.replaceAll(' ', '_').toLowerCase();
};

const submit = async (
  that: any,
  endpoint: '/profile-info' | '/search-filter',
  data: { [k: string]: any },
): Promise<boolean> => {
  for (const [k, v] of Object.entries(data)) {
    const _eventName = eventName(endpoint, k);

    const currentValue = lastEvent(_eventName);
    if (currentValue === v) {
      return true;
    }

    const method = endpoint === '/profile-info' ? 'patch' : 'post';

    const ok = (await japi(method, '/profile-info', { [k]: v })).ok;

    if (ok) {
      notify(_eventName, v);
    }

    return ok;
  }

  return false;
};

const profileInfoEventName = (titleOrKey: string) =>
  eventName('/profile-info', titleOrKey);

const searchFilterEventName = (titleOrKey: string) =>
  eventName('/search-filter', titleOrKey);

const submitProfileInfo = (that: any, data: { [k: string]: any }) =>
  submit(that, '/profile-info', data);

const submitSearchFilter = (that, data: { [k: string]: any }) =>
  submit(that, '/search-filter', data);

// TODO: Ensure search filters get values
// TODO: Ensure search filters set values
// TODO: Need to call in search filters to get current value
const newCheckChipValues = (
  currentValues: { label: string, checked: boolean }[],
  newValues: string[],
) => {
  return currentValues.map((v) => ({
    ...v,
    checked: newValues.includes(v.label),
  }));
};

const genders = [
  'Man',
  'Woman',
  'Agender',
  'Intersex',
  'Non-binary',
  'Transgender',
  'Trans woman',
  'Trans man',
  'Other',
];

const orientations = [
  'Straight',
  'Gay',
  'Lesbian',
  'Bisexual',
  'Asexual',
  'Demisexual',
  'Pansexual',
  'Queer',
  'Other',
];

const ethnicities = [
  'Black/African Descent',
  'East Asian',
  'Hispanic/Latino',
  'Middle Eastern',
  'Native American',
  'Pacific Islander',
  'South Asian',
  'Southeast Asian',
  'White/Caucasian',
  'Other'
];

const religions = [
  'Agnostic',
  'Atheist',
  'Buddhist',
  'Christian',
  'Hindu',
  'Jewish',
  'Muslim',
  'Zoroastrian',
  'Other',
];

const starSigns = [
  'Aquarius',
  'Aries',
  'Cancer',
  'Capricorn',
  'Gemini',
  'Leo',
  'Libra',
  'Pisces',
  'Sagittarius',
  'Scorpio',
  'Taurus',
  'Virgo',
];

const lookingFor = [
  'Friends',
  'Short-term dating',
  'Long-term dating',
  'Marriage',
];

const relationshipStatus = [
  'Single',
  'Seeing someone',
  'Engaged',
  'Married',
  'Divorced',
  'Widowed',
  'Other',
];

const yesNo = [
  'Yes',
  'No',
];

const yesNoMaybe = [
  'Yes',
  'No',
  'Maybe'
];

const frequency = [
  'Often',
  'Sometimes',
  'Never',
];

const immediacy = [
  'Immediately',
  'Daily',
  'Every 3 days',
  'Weekly',
  'Never'
];

const verificationLevel = [
  'No verification',
  'Basics only',
  'Photos',
];

const verificationDescription = `
To prove you’re real, you can take a selfie while you do three things at once:

\xa0\xa01. Smile 😊
\xa0\xa02. Give one thumb down 👎
\xa0\xa03. Touch your eyebrow 🤨

You can use one hand for those last two by touching your eyebrow with your thumb. Using two hands is also fine. Our AI will check your selfie and let you know if you’re verified.

To verify your photos, your face should be in at least one profile pic. But never reveal your verification selfie to anyone, or they can pretend they’re you.
`.trim();

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  bullet: {
    color: 'white',
    flexShrink: 1,
  },
  bulletText: {
    color: 'white',
    flexShrink: 1
  },
  list: {
    gap: 1,
  },
});

const FinishOnboardingDescription = () => (
  <View style={{ gap: 15 }}>
    <DefaultText style={{ color: 'white' }}>
      You’re ready to go! But before we unleash you on the other members, let’s
      recap our Guidelines. Do:
    </DefaultText>

    <View style={styles.list}>
      <View style={styles.row}>
        <DefaultText style={styles.bullet}>✅</DefaultText>
        <DefaultText style={styles.bulletText}>Respect others</DefaultText>
      </View>

      <View style={styles.row}>
        <DefaultText style={styles.bullet}>✅</DefaultText>
        <DefaultText style={styles.bulletText}>Be 18 or older</DefaultText>
      </View>

      <View style={styles.row}>
        <DefaultText style={styles.bullet}>✅</DefaultText>
        <DefaultText style={styles.bulletText}>
          Frame our {}

          <DefaultText
            onPress={() => Linking.openURL('https://duolicious.app/guidelines/')}
            style={{ fontWeight: '700' }}
          >
            Community Guidelines
          </DefaultText>
          {} and hang them on your wall
        </DefaultText>
      </View>
    </View>

    <DefaultText style={{ color: 'white' }}>
      Don’t:
    </DefaultText>

    <View style={styles.list}>
      <View style={styles.row}>
        <DefaultText style={styles.bullet}>❌</DefaultText>
        <DefaultText style={styles.bulletText}>
          Be racist, sexist, or any -ist that makes people sad
        </DefaultText>
      </View>

      <View style={styles.row}>
        <DefaultText style={styles.bullet}>❌</DefaultText>
        <DefaultText style={styles.bulletText}>
          Promote self-harm, or harm of others
        </DefaultText>
      </View>
    </View>

    <DefaultText style={{ color: 'white' }}>
      tl;dr – We want everyone to have fun. Now get in there and find a cute
      date!
    </DefaultText>
  </View>
);

const DeletionDescription = () => (
  <DefaultText style={descriptionStyle.style} >
    Are you sure you want to delete your account? {}
    <DefaultText style={{ fontWeight: '700' }}>
      This will
      permanently delete your account data and
      immediately log you out.
    </DefaultText> {}
    If you’re sure, type “delete” to confirm.
    {Platform.OS === 'web' &&
      <DefaultText>
        {'\n\n'}
        Please consider donating before leaving by pressing {}
        <DefaultText
          onPress={() => Linking.openURL('https://ko-fi.com/duolicious')}
          style={{ fontWeight: '700' }}
        >
          here{'\xa0'}💕
        </DefaultText>
      </DefaultText>
    }
  </DefaultText>
);

const DeactivationDescription = () => (
  <DefaultText style={descriptionStyle.style} >
    Are you sure you want to deactivate your account? {}
    <DefaultText style={{ fontWeight: '700' }}>
      This will hide you from other users and log you out.
    </DefaultText> {}
    The next time you sign in, your account will be reactivated. Press
    “continue” to deactivate your account.
    {Platform.OS === 'web' &&
      <DefaultText>
        {'\n\n'}
        Please consider donating before leaving by pressing {}
        <DefaultText
          onPress={() => Linking.openURL('https://ko-fi.com/duolicious')}
          style={{ fontWeight: '700' }}
        >
          here{'\xa0'}💕
        </DefaultText>
      </DefaultText>
    }
  </DefaultText>
);

const genderOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Gender',
  Icon: () => (
    <FontAwesomeIcon
      icon={faVenusMars}
      size={14}
      style={{color: 'black'}}
    />
  ),
  description: "What’s your gender?",
  input: {
    buttons: {
      values: genders,
      submit: async function(gender: string) {
        const ok = await submitProfileInfo(this, { gender });

        if (ok) {
          notify<VerificationEvent>('updated-verification', { gender: false });
        }

        return ok;
      },
    }
  }
};

const yourPartnersGenderOptionGroup: OptionGroup<OptionGroupCheckChips> = {
  title: "Your Partner’s Gender",
  description: "Which gender do you want to date? You can select more than one option",
  input: {
    checkChips: {
      values: genders.map((x) => ({checked: false, label: x})),
      submit: async (inputs: string[]) => true
    }
  }
};

const ethnicityOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Ethnicity',
  Icon: () => <Ionicons style={{fontSize: 16 }} name="globe-outline" />,
  description: "What’s your ethnicity?",
  input: {
    buttons: {
      values: ethnicities,
      submit: async function(ethnicity: string) {
        const ok = await submitProfileInfo({ ethnicity });

        if (ok) {
          notify<VerificationEvent>('updated-verification', { ethnicity: false });
        }

        return ok;
      },
    }
  },
};

const locationOptionGroup: OptionGroup<OptionGroupLocationSelector> = {
  title: 'Location',
  Icon: () => (
    <FontAwesomeIcon
      icon={faLocationDot}
      size={14}
      style={{color: 'black'}}
    />
  ),
  description: "What city do you live in?",
  input: {
    locationSelector: {
      submit: async function(location: string) {
        return await submitProfileInfo({ location });
      },
    }
  },
  scrollView: false,
};

const orientationOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Orientation',
  Icon: () => <Ionicons style={{fontSize: 16 }} name="person" />,
  description: "What’s your sexual orientation?",
  input: {
    buttons: {
      values: orientations,
      submit: async function(orientation: string) {
        return await submitProfileInfo({ orientation });
      },
    }
  },
};

const lookingForOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Looking For',
  Icon: () => <Ionicons style={{fontSize: 16 }} name="eye" />,
  description: 'What are you mainly looking for on Duolicious?',
  input: {
    buttons: {
      values: lookingFor,
      submit: async function(looking_for: string) {
        return await submitProfileInfo({ looking_for });
      },
    }
  }
};

const basicsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  genderOptionGroup,
  locationOptionGroup,
  orientationOptionGroup,
  ethnicityOptionGroup,
  {
    title: 'Occupation',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="briefcase" />,
    description: "What’s your profession?",
    input: {
      textShort: {
        submit: async function(occupation: string) {
          return await submitProfileInfo({ occupation });
        },
        invalidMsg: 'Try again',
      }
    }
  },
  {
    title: 'Education',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="school" />,
    description: "Where did you study?",
    input: {
      textShort: {
        submit: async function(education: string) {
          return await submitProfileInfo({ education });
        },
        invalidMsg: 'Try again',
      }
    }
  },
  {
    title: 'Height',
    Icon: () => (
      <FontAwesomeIcon
        icon={faRulerVertical}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "How tall are you?",
    input: {
      slider: {
        sliderMin: 100,
        sliderMax: 220,
        defaultValue: 170,
        step: 1,
        unitsLabel: cmToLocaleUnitsStr,
        valueRewriter: cmToLocaleStr,
        submit: async function(height: number) {
          return await submitProfileInfo({ height });
        },
      },
    },
  },
  lookingForOptionGroup,
  {
    title: 'Smoking',
    Icon: () => (
      <FontAwesomeIcon
        icon={faSmoking}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: 'Do you smoke?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(smoking: string) {
          return await submitProfileInfo({ smoking });
        },
      }
    },
  },
  {
    title: 'Drinking',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="wine" />,
    description: 'How often do you drink?',
    input: {
      buttons: {
        values: frequency,
        submit: async function(drinking: string) {
          return await submitProfileInfo({ drinking });
        },
      }
    },
  },
  {
    title: 'Drugs',
    Icon: () => (
      <FontAwesomeIcon
        icon={faPills}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: 'Do you do drugs?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(drugs: string) {
          return await submitProfileInfo({ drugs });
        },
      }
    },
  },
  {
    title: 'Long Distance',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="globe" />,
    description: 'Are you willing to enter a long-distance relationship?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(long_distance: string) {
          return await submitProfileInfo({ long_distance });
        },
      }
    },
  },
  {
    title: 'Relationship Status',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="heart" />,
    description: "What’s your relationship status?",
    input: {
      buttons: {
        values: relationshipStatus,
        submit: async function(relationship_status: string) {
          return await submitProfileInfo({ relationship_status });
        },
      }
    }
  },
  {
    title: 'Has Kids',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="people" />,
    description: 'Do you have kids?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(has_kids: string) {
          return await submitProfileInfo({ has_kids });
        },
      }
    },
  },
  {
    title: 'Wants Kids',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="people" />,
    description: 'Do you want kids?',
    input: {
      buttons: {
        values: yesNoMaybe,
        submit: async function(wants_kids: string) {
          return await submitProfileInfo({ wants_kids });
        },
      }
    },
  },
  {
    title: 'Exercise',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="barbell" />,
    description: 'How often do you exercise?',
    input: {
      buttons: {
        values: frequency,
        submit: async function(exercise: string) {
          return await submitProfileInfo({ exercise });
        },
      }
    },
  },
  {
    title: 'Religion',
    Icon: () => (
      <FontAwesomeIcon
        icon={faHandsPraying}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "What’s your religion?",
    input: {
      buttons: {
        values: religions,
        submit: async function(religion: string) {
          return await submitProfileInfo({ religion });
        },
      }
    },
  },
  {
    title: 'Star Sign',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="star" />,
    description: "What’s your star sign?",
    input: {
      buttons: {
        values: starSigns,
        submit: async function(star_sign: string) {
          return await submitProfileInfo({ star_sign });
        },
      }
    },
  },
];

const themePickerOptionGroups: OptionGroup<OptionGroupThemePicker>[] = [
  {
    title: 'Theme',
    Icon: () => (
      <FontAwesomeIcon
        icon={faPalette}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Customize your profile’s appearance",
    input: {
      themePicker: {
        submit: async function (titleColor, bodyColor, backgroundColor) {
          const theme = {
            title_color: titleColor,
            body_color: bodyColor,
            background_color: backgroundColor,
          };

          return await submitProfileInfo({ theme });
        },
      },
    },
  }
];

const generalSettingsOptionGroups: OptionGroup<OptionGroupButtons>[] = [
  {
    title: 'Units',
    Icon: () => (
      <FontAwesomeIcon
        icon={faRuler}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Do you use the metric system, or the imperial system?",
    input: {
      buttons: {
        values: ['Metric', 'Imperial'],
        submit: async function(units: 'Imperial' | 'Metric') {
          const ok = await submitProfileInfo({ units });

          if (ok) {
            setSignedInUser((signedInUser) => {
              if (signedInUser) {
                return { ...signedInUser, units }
              } else {
                return signedInUser;
              }
            });
          }

          return ok;
        },
      }
    }
  },
];

const notificationSettingsOptionGroups: OptionGroup<OptionGroupButtons>[] = [
  {
    title: 'Chats',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="chatbubbles" />,
    description: "When do you want to be notified if anyone you’re chatting with sends a new message? (“Daily” still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: {
        values: immediacy,
        submit: async function(chats: string) {
          return await submitProfileInfo({ chats });
        },
      }
    }
  },
  {
    title: 'Intros',
    Icon: () => <Ionicons style={{fontSize: 16 }} name="chatbubble" />,
    description: "When do you want to be notified if someone you haven’t chatted with sends you an intro? (“Daily” still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: {
        values: immediacy,
        submit: async function(intros: string) {
          return await submitProfileInfo({ intros });
        },
      }
    }
  },
];

const deletionOptionGroups: OptionGroup<OptionGroupTextShort>[] = [
  {
    title: 'Delete My Account',
    description: DeletionDescription,
    input: {
      textShort: {
        submit: async (input: string) => {
          await logout();

          if ((input ?? '').toLowerCase().trim() !== 'delete') return false;

          const response = await japi('delete', '/account');

          if (!response.ok) return false;

          await sessionPersonUuid(null);
          await sessionToken(null);
          setSignedInUser(undefined);

          navigationContainerRef.reset({ routes: [ { name: 'Welcome' } ]});

          return false;
        },
        invalidMsg: 'Try again',
      }
    }
  },
];

const deactivationOptionGroups: OptionGroup<OptionGroupNone>[] = [
  {
    title: 'Deactivate My Account',
    description: DeactivationDescription,
    input: {
      none: {
        submit: async () => {
          const ok = (await japi('post', '/deactivate')).ok
          if (ok) {
            await sessionPersonUuid(null);
            await sessionToken(null);
            setSignedInUser(undefined);

            navigationContainerRef.reset({ routes: [ { name: 'Welcome' } ]});
          }
          return false;
        }
      }
    }
  },
];

const createAccountOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: "Password",
    description: "Enter the one-time password you just received to create an account or sign in",
    input: {
      otp: {
        submit: async (input) => {
          const existingSessionToken = await sessionToken();
          const response = await japi('post', '/check-otp', { otp: input });

          if (!response.ok) return false;
          if (typeof existingSessionToken !== 'string') return false;

          const onboarded = response.json.onboarded;
          const clubs: ClubItem[] = response?.json?.clubs;
          const pendingClub = response?.json?.pending_club;
          const personUuid: string = response?.json?.person_uuid;

          if (!onboarded) {
            return true;
          } else if (!navigationContainerRef.current) {
            ;
          } else if (pendingClub) {
            navigationContainerRef.reset({
              routes: [
                {
                  name: "Home",
                  state: {
                    routes: [
                      {
                        name: "Search"
                      }
                    ]
                  }
                }
              ]
            });
          } else {
            navigationContainerRef.reset({
              routes: [ { name: 'Home' } ]
            });
          }

          login(personUuid, existingSessionToken);

          setSignedInUser((signedInUser) => ({
            personId: response?.json?.person_id,
            personUuid: personUuid,
            units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
            sessionToken: existingSessionToken,
            pendingClub: pendingClub,
            doShowDonationNag: response?.json?.do_show_donation_nag,
            estimatedEndDate: new Date(response?.json?.estimated_end_date),
            name: response?.json?.name,
          }));

          await sessionPersonUuid(personUuid);

          notify<ClubItem[]>('updated-clubs', clubs);

          return false;
        }
      }
    },
  },
  {
    title: "Step 1 of 5: Display Name",
    description: "This could be your first name, or an alias",
    input: {
      givenName: {
        submit: async (input) => await onboardingQueue.addTask(
          async () =>
            (await japi(
              'patch',
              '/onboardee-info',
              { name: input })).ok
        ),
      }
    },
  },
  _.merge(
    {},
    genderOptionGroup,
    {
      title: 'Step 2 of 5: Your Gender',
      input: {
        buttons: {
          submit: async (input) => await onboardingQueue.addTask(
            async () =>
              (await japi(
                'patch',
                '/onboardee-info',
                { gender: input })).ok
          ),
          currentValue: 'Man',
        }
      }
    },
  ),
  _.merge(
    {},
    yourPartnersGenderOptionGroup,
    {
      title: 'Step 3 of 5: ' + yourPartnersGenderOptionGroup.title,
      input: {
        checkChips: {
          submit: async (input: string[]) => await onboardingQueue.addTask(
            async () =>
              (await japi(
                'patch',
                '/onboardee-info',
                { other_peoples_genders: input })).ok
          ),
        }
      }
    },
  ),
  {
    title: 'Step 4 of 5: Birth Date',
    description: "When were you born? You can’t change this later",
    input: {
      date: {
        submit: async (input) => await onboardingQueue.addTask(
          async () =>
            (await japi(
              'patch',
              '/onboardee-info',
              { date_of_birth: input })).ok
        ),
      }
    },
    scrollView: false,
  },
  _.merge(
    {},
    locationOptionGroup,
    {
      title: 'Step 5 of 5: ' + locationOptionGroup.title,
      input: {
        locationSelector: {
          submit: async (input) => await onboardingQueue.addTask(
            async () =>
              (await japi(
                'patch',
                '/onboardee-info',
                { location: input })).ok
          ),
        }
      }
    },
  ),
  {
    title: "You’re Looking Like A Snack\u00A0😋",
    description: "",
    buttonLabel: 'Complete Sign Up',
    input: {
      none: {
        description: FinishOnboardingDescription,
        submit: async () => {
          const existingSessionToken = await sessionToken();
          const response = await onboardingQueue.addTask(
            async () => await japi('post', '/finish-onboarding')
          );

          if (!response.ok) return false;
          if (typeof existingSessionToken !== 'string') return false;

          const clubs: ClubItem[] = response?.json?.clubs;
          const pendingClub = response?.json?.pending_club;
          const personUuid: string = response?.json?.person_uuid;

          if (!navigationContainerRef.current) {
            ;
          } else if (pendingClub) {
            navigationContainerRef.reset({
              routes: [
                {
                  name: "Home",
                  state: {
                    routes: [
                      {
                        name: "Search"
                      }
                    ]
                  }
                }
              ]
            });
          } else {
            navigationContainerRef.reset({
              routes: [ { name: 'Home' } ]
            });
          }

          login(personUuid, existingSessionToken);

          setSignedInUser((signedInUser) => ({
            sessionToken: existingSessionToken ?? '',
            ...signedInUser,
            personId: response?.json?.person_id,
            personUuid: personUuid,
            units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
            pendingClub: pendingClub,
            doShowDonationNag: response?.json?.do_show_donation_nag,
            estimatedEndDate: new Date(response?.json?.estimated_end_date),
            name: response?.json?.name,
          }));

          await sessionPersonUuid(response?.json?.person_uuid);

          notify<ClubItem[]>('updated-clubs', clubs);

          return false;
        }
      }
    }
  },
];

const searchTwoWayBasicsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    ...yourPartnersGenderOptionGroup,
    title: "Gender",
    Icon: () => (
      <FontAwesomeIcon
        icon={faVenusMars}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Which genders would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...yourPartnersGenderOptionGroup.input.checkChips.values,
        ],
        submit: async function(gender: string[]) {
          return submitSearchFilter({ gender });
        }
      }
    },
  },
  {
    title: "Furthest Distance",
    Icon: () => (
      <FontAwesomeIcon
        icon={faLocationDot}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "How far away can people be?",
    input: {
      slider: {
        sliderMin: 5,
        sliderMax: 10000,
        defaultValue: 10000,
        step: 1,
        unitsLabel: kmToLocaleUnitsStr,
        valueRewriter: kmToLocaleStr,
        addPlusAtMax: true,
        scale: LOGARITHMIC_SCALE,
        submit: async function(furthest_distance: number | null) {
          return submitSearchFilter({ furthest_distance });
        },
      },
    },
  },
  {
    title: "Age",
    Icon: () => (
      <FontAwesomeIcon
        icon={faCalendar}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "What ages would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 18,
        sliderMax: 99,
        unitsLabel: () => 'years',
        submit: async function(min_age: number | null, max_age: number | null) {
          return submitSearchFilter({ age: { min_age, max_age } });
        },
      }
    },
  },
];

const searchOtherBasicsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: "Orientation",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="person" />,
    description: "Which orientations would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...orientations.map((x) => ({checked: true, label: x})),
          { checked: true, label: 'Unanswered' },
        ],
        submit: async function(orientation: string[]) {
          return submitSearchFilter({ orientation });
        }
      }
    },
  },
  {
    title: "Ethnicity",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="globe-outline" />,
    description: "Which ethnicities would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...ethnicities.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(ethnicity: string[]) {
          return submitSearchFilter({ ethnicity });
        }
      }
    },
  },
  {
    title: "Height",
    Icon: () => (
      <FontAwesomeIcon
        icon={faRulerVertical}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "What heights of people would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 50,
        sliderMax: 220,
        unitsLabel: cmToLocaleUnitsStr,
        valueRewriter: cmToLocaleStr,
        submit: async function(min_height_cm: number | null, max_height_cm: number | null) {
          return submitSearchFilter({ height: { min_height_cm, max_height_cm } });
        },
      },
    },
  },
  {
    title: "Has a Profile Picture",
    Icon: () => (
      <FontAwesomeIcon
        icon={faImage}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Do you want to see people who have a profile picture? Selecting ‘Yes’ and ‘No’ includes everyone, though people who have pictures will be shown first.",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
        ],
        submit: async function(has_a_profile_picture: string[]) {
          return submitSearchFilter({ has_a_profile_picture });
        }
      }
    },
  },
  {
    title: "Looking For",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="eye" />,
    description: "What kind of relationships would you like people in search results to be seeking?",
    input: {
      checkChips: {
        values: [
          ...lookingFor.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(looking_for: string[]) {
          return submitSearchFilter({ looking_for });
        }
      }
    },
  },
  {
    title: "Smoking",
    Icon: () => (
      <FontAwesomeIcon
        icon={faSmoking}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Do you want to include people who smoke in search results?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(smoking: string[]) {
          return submitSearchFilter({ smoking });
        }
      }
    },
  },
  {
    title: "Drinking",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="wine" />,
    description: "Do you want to include people who drink alcohol in search results?",
    input: {
      checkChips: {
        values: [
          ...frequency.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(drinking: string[]) {
          return submitSearchFilter({ drinking });
        }
      }
    },
  },
  {
    title: "Drugs",
    Icon: () => (
      <FontAwesomeIcon
        icon={faPills}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Do you want to include people who take drugs in search results?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(drugs: string[]) {
          return submitSearchFilter({ drugs });
        }
      }
    },
  },
  {
    title: "Long Distance",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="globe" />,
    description: "Do you want search results to include people willing to enter a long-distance relationship?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(long_distance: string[]) {
          return submitSearchFilter({ long_distance });
        }
      }
    },
  },
  {
    title: "Relationship Status",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="heart" />,
    description: "Which relationship statuses are you willing to accept from people in your search results?",
    input: {
      checkChips: {
        values: [
          ...relationshipStatus.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(relationship_status: string[]) {
          return submitSearchFilter({ relationship_status });
        }
      }
    },
  },
  {
    title: "Has Kids",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="people" />,
    description: "Do you want search results to include people who had kids?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(has_kids: string[]) {
          return submitSearchFilter({ has_kids });
        }
      }
    },
  },
  {
    title: "Wants Kids",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="people" />,
    description: "Do you want search results to include people who want kids?",
    input: {
      checkChips: {
        values: [
          ...yesNoMaybe.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(wants_kids: string[]) {
          return submitSearchFilter({ wants_kids });
        }
      }
    },
  },
  {
    title: "Exercise",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="barbell" />,
    description: "Do you want search results to include people who exercise?",
    input: {
      checkChips: {
        values: [
          ...frequency.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(exercise: string[]) {
          return submitSearchFilter({ exercise });
        }
      }
    },
  },
  {
    title: "Religion",
    Icon: () => (
      <FontAwesomeIcon
        icon={faHandsPraying}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Which religions do you want to see in search results?",
    input: {
      checkChips: {
      values: [
          ...religions.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(religion: string[]) {
          return submitSearchFilter({ religion });
        }
      }
    },
  },
  {
    title: "Star Sign",
    Icon: () => <Ionicons style={{fontSize: 16 }} name="star" />,
    description: "What star signs would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...starSigns.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(star_sign: string[]) {
          return submitSearchFilter({ star_sign });
        }
      }
    },
  },
];

const searchInteractionsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: "People You Messaged",
    Icon: () => (
      <FontAwesomeIcon
        icon={faPaperPlane}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Would you like search results to include people you already messaged?",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(people_messaged: string) {
          return submitSearchFilter({ people_messaged });
        }
      }
    },
  },
  {
    title: "People You Skipped",
    Icon: () => (
      <X
        stroke="black"
        strokeWidth={4}
        height={14}
        width={14}
      />
    ),
    description: "Would you like search results to include people you skipped?",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(people_skipped: string) {
          return submitSearchFilter({ people_skipped });
        }
      }
    },
  },
];

const privacySettingsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: 'Verification Level',
    Icon: () => <VerificationBadge color="black" size={14} />,
    description: "What’s the minimum verification level that people need to view your profile in search results?",
    input: {
      buttons: {
        values: verificationLevel,
        submit: async function(verification_level: string) {
          return await submitProfileInfo({ verification_level });
        },
      }
    },
  },
  {
    title: 'Show My Location',
    Icon: () => (
      <FontAwesomeIcon
        icon={faLocationDot}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Would you like your location to appear on your profile? Note that if you set this option to ‘No’, other people will still be able to filter your profile by distance when searching.",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(show_my_location: string) {
          return await submitProfileInfo({ show_my_location });
        },
      }
    },
  },
  {
    title: 'Show My Age',
    Icon: () => (
      <FontAwesomeIcon
        icon={faCalendar}
        size={14}
        style={{color: 'black'}}
      />
    ),
    description: "Would you like your age to appear on your profile? Note that if you set this option to ‘No’, other people will still be able to filter your profile by age when searching.",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(show_my_age: string) {
          return await submitProfileInfo({ show_my_age });
        },
      }
    },
  },
  {
    title: 'Hide Me From Strangers',
    Icon: () => (
      <Ionicons
        style={{
          transform: [ { scaleX: -1 } ],
          fontSize: 16,
        }}
        name="chatbubble"
      />
    ),
    description: "With this option set to ‘Yes’, people won’t see you anywhere in Duolicious until you message them first.",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(hide_me_from_strangers: string) {
          return await submitProfileInfo({ hide_me_from_strangers });
        },
      }
    },
  },
];

const verificationOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: 'Get Verified',
    Icon: VerificationBadge,
    description: 'Get a pretty blue badge by taking a selfie!',
    input: {
      none: {
        description: verificationDescription,
        textAlign: 'left',
        submit: async () => true,
      }
    }
  },
  {
    title: 'Get Verified',
    description: `Press ‘Continue’ to submit your selfie.`,
    input: {
      photos: {
        submit: async (position, cropperOutput) => {
          const response = await japi(
            'post',
            '/verification-selfie',
            {
              base64_file: {
                position: 1,
                base64: cropperOutput.originalBase64,
                top: cropperOutput.top,
                left: cropperOutput.left,
              },
            },
            2 * 60 * 1000, // 2 minutes
            undefined,
            true,
          );

          return response.ok;
        },
        submitAll: async () => api('post', '/verify', undefined, undefined, 0),
        delete: async () => true,
        showProtip: false,
        validateAtLeastOne: true,
        firstFileNumber: -1,
      }
    }
  },
  {
    title: 'Results',
    description: '',
    input: {
      verificationChecker: {}
    }
  },
];

export {
  OptionGroup,
  OptionGroupButtons,
  OptionGroupCheckChips,
  OptionGroupDate,
  OptionGroupGivenName,
  OptionGroupInputs,
  OptionGroupLocationSelector,
  OptionGroupNone,
  OptionGroupOtp,
  OptionGroupPhotos,
  OptionGroupRangeSlider,
  OptionGroupSlider,
  OptionGroupTextLong,
  OptionGroupTextShort,
  OptionGroupThemePicker,
  OptionGroupVerificationChecker,
  basicsOptionGroups,
  createAccountOptionGroups,
  deactivationOptionGroups,
  deletionOptionGroups,
  descriptionStyle,
  generalSettingsOptionGroups,
  getCurrentValue,
  isOptionGroupButtons,
  isOptionGroupCheckChips,
  isOptionGroupDate,
  isOptionGroupGivenName,
  isOptionGroupLocationSelector,
  isOptionGroupNone,
  isOptionGroupOtp,
  isOptionGroupPhotos,
  isOptionGroupRangeSlider,
  isOptionGroupSlider,
  isOptionGroupTextLong,
  isOptionGroupTextShort,
  isOptionGroupThemePicker,
  isOptionGroupVerificationChecker,
  maxDailySelfies,
  noneFontSize,
  notificationSettingsOptionGroups,
  privacySettingsOptionGroups,
  profileInfoEventName,
  searchInteractionsOptionGroups,
  searchOtherBasicsOptionGroups,
  searchTwoWayBasicsOptionGroups,
  themePickerOptionGroups,
  verificationOptionGroups,
};
