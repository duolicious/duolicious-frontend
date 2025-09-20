import * as _ from "lodash";
import { japi, ApiResponse } from '../api/api';
import { navigationContainerRef } from '../App';
import { setSignedInUser } from '../events/signed-in-user';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { NonNullImageCropperOutput } from '../components/image-cropper';
import { login, logout } from '../chat/application-layer';
import { LOGARITHMIC_SCALE, Scale } from "../scales/scales";
import { VerificationBadge } from '../components/verification-badge';
import { notify } from '../events/events';
import { ClubItem } from '../club/club';
import { DefaultText } from '../components/default-text';
import {
  Linking,
  StyleSheet,
  View,
} from 'react-native';
import { FC } from 'react';
import { onboardingQueue } from '../api/queue';
import { showVerificationCamera } from '../components/verification-camera';
import { notifyUpdatedVerification } from '../verification/verification';
import { searchQueue } from '../api/queue';
import { setAppThemeName } from '../app-theme/app-theme';

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
    unitsLabel: string,
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
    unitsLabel: string,
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
  'Femboy',
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

const offOn = [
  'Off',
  'On',
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
      recap our <DefaultText
        disableTheme
        onPress={() => Linking.openURL('https://duolicious.app/guidelines/')}
        style={{ fontWeight: '700' }}
      >
        Community Guidelines
      </DefaultText>. Do:
    </DefaultText>

    <View style={styles.list}>
      <View style={styles.row}>
        <DefaultText style={styles.bullet}>✅</DefaultText>
        <DefaultText style={styles.bulletText}>Be 18 or older</DefaultText>
      </View>

      <View style={styles.row}>
        <DefaultText style={styles.bullet}>✅</DefaultText>
        <DefaultText style={styles.bulletText}>Respect others</DefaultText>
      </View>

      <View style={styles.row}>
        <DefaultText style={styles.bullet}>✅</DefaultText>
        <DefaultText style={styles.bulletText}>Keep your profile safe for work</DefaultText>
      </View>

      <View style={styles.row}>
        <DefaultText style={styles.bullet}>✅</DefaultText>
        <DefaultText style={styles.bulletText}>Report anyone requesting money or gifts, or selling things</DefaultText>
      </View>
    </View>

    <DefaultText style={{ color: 'white' }}>
      Don’t:
    </DefaultText>

    <View style={styles.list}>
      <View style={styles.row}>
        <DefaultText style={styles.bullet}>❌</DefaultText>
        <DefaultText style={styles.bulletText}>
          Be racist, sexist, etc
        </DefaultText>
      </View>

      <View style={styles.row}>
        <DefaultText style={styles.bullet}>❌</DefaultText>
        <DefaultText style={styles.bulletText}>
          Promote harm or self-harm
        </DefaultText>
      </View>
    </View>

    <DefaultText style={{ color: 'white' }}>
      tl;dr – We want everyone to have a good time! Now get in there and find a
      cute date!
    </DefaultText>
  </View>
);

const DeletionDescription = () => (
  <DefaultText style={descriptionStyle.style} >
    Are you sure you want to delete your account? {}
    <DefaultText disableTheme style={{ fontWeight: '700' }}>
      This will
      permanently delete your account data and
      immediately log you out.
    </DefaultText> {}
    If you’re sure, type “delete” to confirm.
  </DefaultText>
);

const DeactivationDescription = () => (
  <DefaultText style={descriptionStyle.style} >
    Are you sure you want to deactivate your account? {}
    <DefaultText disableTheme style={{ fontWeight: '700' }}>
      This will hide you from other users and log you out.
    </DefaultText> {}
    The next time you sign in, your account will be reactivated. Press
    “continue” to deactivate your account.
  </DefaultText>
);

const genderOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Gender',
  Icon: ({ color = 'black' }) => (
    <FontAwesomeIcon
      icon={faVenusMars}
      size={14}
      style={{ color }}
    />
  ),
  description: "What’s your gender?",
  input: {
    buttons: {
      values: genders,
      submit: async function(gender: string) {
        if (this.currentValue === gender) {
          return true;
        }

        const ok = (await japi('patch', '/profile-info', { gender })).ok;
        if (ok) {
          this.currentValue = gender;
          notifyUpdatedVerification({ gender: false });
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
      submit: async (_: string[]) => true
    }
  }
};

const ethnicityOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Ethnicity',
  Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="globe-outline" />,
  description: "What’s your ethnicity?",
  input: {
    buttons: {
      values: ethnicities,
      submit: async function(ethnicity: string) {
        if (this.currentValue === ethnicity) {
          return true;
        }

        const ok = (await japi('patch', '/profile-info', { ethnicity })).ok;
        if (ok) {
          this.currentValue = ethnicity;
          notifyUpdatedVerification({ ethnicity: false });
        }
        return ok;
      },
    }
  },
};

const locationOptionGroup: OptionGroup<OptionGroupLocationSelector> = {
  title: 'Location',
  Icon: ({ color = 'black' }) => (
    <FontAwesomeIcon
      icon={faLocationDot}
      size={14}
      style={{ color }}
    />
  ),
  description: "What city do you live in?",
  input: {
    locationSelector: {
      submit: async function(location: string) {
        const ok = (await japi('patch', '/profile-info', { location })).ok;
        if (ok) this.currentValue = location;
        return ok;
      },
    }
  },
  scrollView: false,
};

const orientationOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Orientation',
  Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="person" />,
  description: "What’s your sexual orientation?",
  input: {
    buttons: {
      values: orientations,
      submit: async function(orientation: string) {
        const ok = (await japi('patch', '/profile-info', { orientation })).ok;
        if (ok) this.currentValue = orientation;
        return ok;
      },
    }
  },
};

const lookingForOptionGroup: OptionGroup<OptionGroupButtons> = {
  title: 'Looking For',
  Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="eye" />,
  description: 'What are you mainly looking for on Duolicious?',
  input: {
    buttons: {
      values: lookingFor,
      submit: async function(lookingFor: string) {
        const ok = (await japi('patch', '/profile-info', { looking_for: lookingFor })).ok;
        if (ok) this.currentValue = lookingFor;
        return ok;
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
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="briefcase" />,
    description: "What’s your profession?",
    input: {
      textShort: {
        submit: async function(occupation: string) {
          const ok = (await japi('patch', '/profile-info', { occupation })).ok;
          if (ok) this.currentValue = occupation;
          return ok;
        },
        invalidMsg: 'Try again',
      }
    }
  },
  {
    title: 'Education',
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="school" />,
    description: "Where did you study?",
    input: {
      textShort: {
        submit: async function(education: string) {
          const ok = (await japi('patch', '/profile-info', { education })).ok;
          if (ok) this.currentValue = education;
          return ok;
        },
        invalidMsg: 'Try again',
      }
    }
  },
  {
    title: 'Height',
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faRulerVertical}
        size={14}
        style={{ color }}
      />
    ),
    description: "How tall are you?",
    input: {
      slider: {
        sliderMin: 100,
        sliderMax: 220,
        defaultValue: 170,
        step: 1,
        unitsLabel: 'cm',
        submit: async function(height: number) {
          const ok = (await japi('patch', '/profile-info', { height })).ok;
          if (ok) this.currentValue = height;
          return ok;
        },
      },
    },
  },
  lookingForOptionGroup,
  {
    title: 'Smoking',
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faSmoking}
        size={14}
        style={{ color }}
      />
    ),
    description: 'Do you smoke?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(smoking: string) {
          const ok = (await japi('patch', '/profile-info', { smoking })).ok;
          if (ok) this.currentValue = smoking;
          return ok;
        },
      }
    },
  },
  {
    title: 'Drinking',
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="wine" />,
    description: 'How often do you drink?',
    input: {
      buttons: {
        values: frequency,
        submit: async function(drinking: string) {
          const ok = (await japi('patch', '/profile-info', { drinking })).ok;
          if (ok) this.currentValue = drinking;
          return ok;
        },
      }
    },
  },
  {
    title: 'Drugs',
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faPills}
        size={14}
        style={{ color }}
      />
    ),
    description: 'Do you do drugs?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(drugs: string) {
          const ok = (await japi('patch', '/profile-info', { drugs })).ok;
          if (ok) this.currentValue = drugs;
          return ok;
        },
      }
    },
  },
  {
    title: 'Long Distance',
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="globe" />,
    description: 'Are you willing to enter a long-distance relationship?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(longDistance: string) {
          const ok = (await japi('patch', '/profile-info', { long_distance: longDistance })).ok;
          if (ok) this.currentValue = longDistance;
          return ok;
        },
      }
    },
  },
  {
    title: 'Relationship Status',
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="heart" />,
    description: "What’s your relationship status?",
    input: {
      buttons: {
        values: relationshipStatus,
        submit: async function(relationshipStatus: string) {
          const ok = (
            await japi('patch', '/profile-info', { relationship_status: relationshipStatus })
          ).ok;
          if (ok) this.currentValue = relationshipStatus;
          return ok;
        },
      }
    }
  },
  {
    title: 'Has Kids',
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="people" />,
    description: 'Do you have kids?',
    input: {
      buttons: {
        values: yesNo,
        submit: async function(hasKids: string) {
          const ok = (await japi('patch', '/profile-info', { has_kids: hasKids })).ok;
          if (ok) this.currentValue = hasKids;
          return ok;
        },
      }
    },
  },
  {
    title: 'Wants Kids',
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="people" />,
    description: 'Do you want kids?',
    input: {
      buttons: {
        values: yesNoMaybe,
        submit: async function(wantsKids: string) {
          const ok = (await japi('patch', '/profile-info', { wants_kids: wantsKids })).ok;
          if (ok) this.currentValue = wantsKids;
          return ok;
        },
      }
    },
  },
  {
    title: 'Exercise',
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="barbell" />,
    description: 'How often do you exercise?',
    input: {
      buttons: {
        values: frequency,
        submit: async function(exercise: string) {
          const ok = (await japi('patch', '/profile-info', { exercise })).ok;
          if (ok) this.currentValue = exercise;
          return ok;
        },
      }
    },
  },
  {
    title: 'Religion',
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faHandsPraying}
        size={14}
        style={{ color }}
      />
    ),
    description: "What’s your religion?",
    input: {
      buttons: {
        values: religions,
        submit: async function(religion: string) {
          const ok = (await japi('patch', '/profile-info', { religion })).ok;
          if (ok) this.currentValue = religion;
          return ok;
        },
      }
    },
  },
  {
    title: 'Star Sign',
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="star" />,
    description: "What’s your star sign?",
    input: {
      buttons: {
        values: starSigns,
        submit: async function(starSign: string) {
          const ok = (await japi('patch', '/profile-info', { star_sign: starSign })).ok;
          if (ok) this.currentValue = starSign;
          return ok;
        },
      }
    },
  },
];

const themePickerOptionGroups: OptionGroup<OptionGroupThemePicker>[] = [
  {
    title: 'Profile Theme',
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faPalette}
        size={14}
        style={{ color }}
      />
    ),
    description: "Customize how your profile appears to other members",
    input: {
      themePicker: {
        submit: async function (titleColor, bodyColor, backgroundColor) {
          const theme = {
            title_color: titleColor,
            body_color: bodyColor,
            background_color: backgroundColor,
          };

          const ok = (await japi('patch', '/profile-info', { theme })).ok;
          if (ok) {
            this.currentTitleColor = titleColor;
            this.currentBodyColor = bodyColor;
            this.currentBackgroundColor = backgroundColor;
          }
          return ok;
        },
      },
    },
  }
];

const appThemePickerOptionGroups: OptionGroup<OptionGroupButtons>[] = [
  {
    title: 'Dark Mode',
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faPalette}
        size={14}
        style={{ color }}
      />
    ),
    description: (
      "Customize your app’s appearance. (Other users’ profile themes might " +
      "appear darker than they intended when you’re in dark mode.)"
    ),
    input: {
      buttons: {
        values: offOn,
        submit: async function(input: 'On' | 'Off') {
          if (input === 'On') {
            setAppThemeName('dark');
          } else {
            setAppThemeName('light');
          }
          this.currentValue = input;
          return true;
        },
      }
    },
  }
];

const generalSettingsOptionGroups: OptionGroup<OptionGroupButtons>[] = [
  {
    title: 'Units',
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faRuler}
        size={14}
        style={{ color }}
      />
    ),
    description: "Do you use the metric system, or the imperial system?",
    input: {
      buttons: {
        values: ['Metric', 'Imperial'],
        submit: async function(units: 'Imperial' | 'Metric') {
          const ok = (await japi('patch', '/profile-info', { units })).ok;
          if (ok) {
            this.currentValue = units;
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
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="chatbubbles" />,
    description: "When do you want to be notified if anyone you’re chatting with sends a new message? (“Daily” still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: {
        values: immediacy,
        submit: async function(chats: string) {
          const ok = (await japi('patch', '/profile-info', { chats })).ok;
          if (ok) this.currentValue = chats;
          return ok;
        },
      }
    }
  },
  {
    title: 'Intros',
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="chatbubble" />,
    description: "When do you want to be notified if someone you haven’t chatted with sends you an intro? (“Daily” still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: {
        values: immediacy,
        submit: async function(intros: string) {
          const ok = (await japi('patch', '/profile-info', { intros })).ok;
          if (ok) this.currentValue = intros;
          return ok;
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

          setSignedInUser({
            personId: response?.json?.person_id,
            personUuid: personUuid,
            units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
            sessionToken: existingSessionToken,
            pendingClub: pendingClub,
            estimatedEndDate: new Date(response?.json?.estimated_end_date),
            name: response?.json?.name,
            hasGold: response?.json?.has_gold,
          });

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
    description: (
      "Get better matches and unlock features for age-verified users by " +
      "setting this accurately. It can’t be changed easily, so make sure " +
      "it’s correct."
    ),
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
            estimatedEndDate: new Date(response?.json?.estimated_end_date),
            name: response?.json?.name,
            hasGold: response?.json?.has_gold,
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
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faVenusMars}
        size={14}
        style={{ color }}
      />
    ),
    description: "Which genders would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...yourPartnersGenderOptionGroup.input.checkChips.values,
        ],
        submit: async function(gender: string[]) {
          const go = async () => {
            const ok = (await japi('post', '/search-filter', { gender })).ok;
            if (ok) {
              this.values = newCheckChipValues(this.values, gender);
            }
            return ok;
          };

          if (gender.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, gender);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Furthest Distance",
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faLocationDot}
        size={14}
        style={{ color }}
      />
    ),
    description: "How far away can people be?",
    input: {
      slider: {
        sliderMin: 5,
        sliderMax: 10000,
        defaultValue: 10000,
        step: 1,
        unitsLabel: 'km',
        addPlusAtMax: true,
        scale: LOGARITHMIC_SCALE,
        submit: async function(furthestDistance: number | null) {
          const go = async () => {
            const ok = (
              await japi(
                'post',
                '/search-filter',
                { furthest_distance: furthestDistance }
              )
            ).ok;
            return ok;
          };
          searchQueue.addTask(go);
          this.currentValue = furthestDistance;
          return true;
        },
      },
    },
  },
  {
    title: "Age",
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faCalendar}
        size={14}
        style={{ color }}
      />
    ),
    description: "What ages would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 18,
        sliderMax: 99,
        unitsLabel: 'years',
        submit: async function(sliderMin: number | null, sliderMax: number | null) {
          const go = async () => {
            const ok = (
              await japi(
                'post',
                '/search-filter',
                {
                  age: {
                    min_age: sliderMin,
                    max_age: sliderMax,
                  }
                }
              )
            ).ok;
            return ok;
          };
          searchQueue.addTask(go);
          this.currentMin = sliderMin;
          this.currentMax = sliderMax;
          return true;
        },
      }
    },
  },
];

const searchOtherBasicsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: "Orientation",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="person" />,
    description: "Which orientations would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...orientations.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(orientation: string[]) {
          const go = async () => {
            const ok = (await japi('post', '/search-filter', { orientation })).ok;
            if (ok) this.values = newCheckChipValues(this.values, orientation);
            return ok;
          };
          if (orientation.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, orientation);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        },
      }
    },
  },
  {
    title: "Ethnicity",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="globe-outline" />,
    description: "Which ethnicities would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...ethnicities.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(ethnicity: string[]) {
          const go = async () => {
            const ok = (await japi('post', '/search-filter', { ethnicity })).ok;
            if (ok) this.values = newCheckChipValues(this.values, ethnicity);
            return ok;
          };

          if (ethnicity.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, ethnicity);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Height",
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faRulerVertical}
        size={14}
        style={{ color }}
      />
    ),
    description: "What heights of people would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 50,
        sliderMax: 220,
        unitsLabel: 'cm',
        submit: async function(sliderMin: number | null, sliderMax: number | null) {
          const go = async () => {
            const ok = (
              await japi(
                'post',
                '/search-filter',
                {
                  height: {
                    min_height_cm: sliderMin,
                    max_height_cm: sliderMax,
                  }
                }
              )
            ).ok;
            return ok;
          };
          searchQueue.addTask(go);
          this.currentMin = sliderMin;
          this.currentMax = sliderMax;
          return true;
        },
      },
    },
  },
  {
    title: "Has a Profile Picture",
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faImage}
        size={14}
        style={{ color }}
      />
    ),
    description: "Do you want to see people who have a profile picture? Selecting ‘Yes’ and ‘No’ includes everyone, though people who have pictures will be shown first.",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
        ],
        submit: async function(hasAProfilePicture: string[]) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { has_a_profile_picture: hasAProfilePicture }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, hasAProfilePicture);
            return ok;
          };
          if (hasAProfilePicture.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, hasAProfilePicture);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Looking For",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="eye" />,
    description: "What kind of relationships would you like people in search results to be seeking?",
    input: {
      checkChips: {
        values: [
          ...lookingFor.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(lookingFor: string[]) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { looking_for: lookingFor }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, lookingFor);
            return ok;
          };
          if (lookingFor.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, lookingFor);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Smoking",
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faSmoking}
        size={14}
        style={{ color }}
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
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { smoking }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, smoking);
            return ok;
          };
          if (smoking.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, smoking);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Drinking",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="wine" />,
    description: "Do you want to include people who drink alcohol in search results?",
    input: {
      checkChips: {
        values: [
          ...frequency.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(drinking: string[]) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { drinking }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, drinking);
            return ok;
          };
          if (drinking.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, drinking);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Drugs",
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faPills}
        size={14}
        style={{ color }}
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
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { drugs }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, drugs);
            return ok;
          };
          if (drugs.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, drugs);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Long Distance",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="globe" />,
    description: "Do you want search results to include people willing to enter a long-distance relationship?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(longDistance: string[]) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { long_distance: longDistance }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, longDistance);
            return ok;
          };
          if (longDistance.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, longDistance);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Relationship Status",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="heart" />,
    description: "Which relationship statuses are you willing to accept from people in your search results?",
    input: {
      checkChips: {
        values: [
          ...relationshipStatus.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(relationshipStatus: string[]) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { relationship_status: relationshipStatus }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, relationshipStatus);
            return ok;
          };
          if (relationshipStatus.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, relationshipStatus);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Has Kids",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="people" />,
    description: "Do you want search results to include people who had kids?",
    input: {
      checkChips: {
        values: [
          ...yesNo.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(hasKids: string[]) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { has_kids: hasKids }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, hasKids);
            return ok;
          };
          if (hasKids.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, hasKids);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Wants Kids",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="people" />,
    description: "Do you want search results to include people who want kids?",
    input: {
      checkChips: {
        values: [
          ...yesNoMaybe.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'}
        ],
        submit: async function(wantsKids: string[]) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { wants_kids: wantsKids }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, wantsKids);
            return ok;
          };
          if (wantsKids.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, wantsKids);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Exercise",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="barbell" />,
    description: "Do you want search results to include people who exercise?",
    input: {
      checkChips: {
        values: [
          ...frequency.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(exercise: string[]) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { exercise }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, exercise);
            return ok;
          };
          if (exercise.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, exercise);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Religion",
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faHandsPraying}
        size={14}
        style={{ color }}
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
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { religion }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, religion);
            return ok;
          };
          if (religion.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, religion);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
  {
    title: "Star Sign",
    Icon: ({ color = 'black' }) => <Ionicons style={{fontSize: 16, color}} name="star" />,
    description: "What star signs would you like to see in search results?",
    input: {
      checkChips: {
        values: [
          ...starSigns.map((x) => ({checked: true, label: x})),
          {checked: true, label: 'Unanswered'},
        ],
        submit: async function(starSign: string[]) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { star_sign: starSign }
            )).ok;
            if (ok) this.values = newCheckChipValues(this.values, starSign);
            return ok;
          };
          if (starSign.length) {
            searchQueue.addTask(go);
            this.values = newCheckChipValues(this.values, starSign);
            return true;
          } else {
            return await searchQueue.addTask(go);
          }
        }
      }
    },
  },
];

const searchInteractionsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: "People You Messaged",
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faPaperPlane}
        size={14}
        style={{ color }}
      />
    ),
    description: "Would you like search results to include people you already messaged?",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(peopleMessaged: string) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { people_you_messaged: peopleMessaged }
            )).ok;
            return ok;
          };
          searchQueue.addTask(go);
          this.currentValue = peopleMessaged;
          return true;
        }
      }
    },
  },
  {
    title: "People You Skipped",
    Icon: ({ color = 'black' }) => (
      <X
        stroke={color}
        strokeWidth={4}
        height={14}
        width={14}
      />
    ),
    description: "Would you like search results to include people you skipped?",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(peopleSkipped: string) {
          const go = async () => {
            const ok = (await japi(
              'post',
              '/search-filter',
              { people_you_skipped: peopleSkipped }
            )).ok;
            return ok;
          };
          searchQueue.addTask(go);
          this.currentValue = peopleSkipped;
          return true;
        }
      }
    },
  },
];

const privacySettingsOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: 'Verification Level',
    Icon: ({ color = 'black' }) => <VerificationBadge
      color={color}
      size={14}
    />,
    description: "What’s the minimum verification level that people need to view your profile in search results?",
    input: {
      buttons: {
        values: verificationLevel,
        submit: async function(verificationLevel: string) {
          const ok = (
            await japi(
              'patch',
              '/profile-info',
              { verification_level: verificationLevel }
            )
          ).ok;
          if (ok) this.currentValue = verificationLevel;
          return ok;
        },
      }
    },
  },
  {
    title: 'Show My Location',
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faLocationDot}
        size={14}
        style={{ color }}
      />
    ),
    description: "Would you like your location to appear on your profile? Note that if you set this option to ‘No’, other people will still be able to filter your profile by distance when searching.",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(showMyLocation: string) {
          const ok = (
            await japi(
              'patch',
              '/profile-info',
              { show_my_location: showMyLocation }
            )
          ).ok;
          if (ok) this.currentValue = showMyLocation;
          return ok;
        },
      }
    },
  },
  {
    title: 'Show My Age',
    Icon: ({ color = 'black' }) => (
      <FontAwesomeIcon
        icon={faCalendar}
        size={14}
        style={{ color }}
      />
    ),
    description: "Would you like your age to appear on your profile? Note that if you set this option to ‘No’, other people will still be able to filter your profile by age when searching.",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(showMyAge: string) {
          const ok = (
            await japi(
              'patch',
              '/profile-info',
              { show_my_age: showMyAge }
            )
          ).ok;
          if (ok) this.currentValue = showMyAge;
          return ok;
        },
      }
    },
  },
  {
    title: 'Hide Me From Strangers',
    Icon: ({ color = 'black' }) => (
      <Ionicons
        style={{
          transform: [ { scaleX: -1 } ],
          fontSize: 16,
          color,
        }}
        name="chatbubble"
      />
    ),
    description: "With this option set to ‘Yes’, people won’t see you anywhere in Duolicious until you message them first.",
    input: {
      buttons: {
        values: yesNo,
        submit: async function(hideMeFromStrangers: string) {
          const ok = (
            await japi(
              'patch',
              '/profile-info',
              { hide_me_from_strangers: hideMeFromStrangers }
            )
          ).ok;
          if (ok) this.currentValue = hideMeFromStrangers;
          return ok;
        },
      }
    },
  },
];

const verificationOptionGroups: OptionGroup<OptionGroupInputs>[] = [
  {
    title: 'Get Verified',
    Icon: () => <VerificationBadge />,
    description: 'Get a pretty blue badge by taking a selfie!',
    input: {
      none: {
        description: verificationDescription,
        textAlign: 'left',
        submit: async () => {
          showVerificationCamera(true);
          return true;
        },
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
  searchInteractionsOptionGroups,
  searchOtherBasicsOptionGroups,
  searchTwoWayBasicsOptionGroups,
  themePickerOptionGroups,
  appThemePickerOptionGroups,
  verificationOptionGroups,
};
