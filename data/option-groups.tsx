import * as _ from "lodash";
import { mapi, japi } from '../api/api';
import { setSignedInUser } from '../App';
import { sessionToken } from '../kv-storage/session-token';

type OptionGroupButtons = {
  buttons: {
    values: string[],
    submit: (input: string) => Promise<boolean>
    defaultValue?: string,
  }
};


type OptionGroupLocationSelector = {
  locationSelector: {
    submit: (input: string) => Promise<boolean>
    defaultValue?: string,
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
    submit: (filename: string, pathOrBase64: string) => Promise<boolean>
    delete: (filename: string) => Promise<boolean>
    fetch?: (position: string) => Promise<string | null>
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
    label: string
    checked: boolean
  }[],
  submit: (input: string[]) => Promise<boolean>
};

type OptionGroupNone = {
  none: {
    description?: string,
    submit: () => Promise<boolean>
  }
};

type OptionGroupSlider = {
  slider: {
    sliderMin: number,
    sliderMax: number,
    defaultValue: number,
    step: number,
    unitsLabel: string,
    submit: (input: number) => Promise<boolean>
    addPlusAtMax?: boolean,
    valueRewriter?: (v: number) => string,
  }
};

type OptionGroupRangeSlider = {
  rangeSlider: {
    sliderMin: number,
    sliderMax: number,
    unitsLabel: string,
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
  | OptionGroupNone;

type OptionGroup = {
  title: string,
  description: string,
  input?: OptionGroupInputs,
  scrollView?: boolean,
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

const isOptionGroupNone = (x: any): x is OptionGroupNone => {
  return hasExactKeys(x, ['none']);
}

const isOptionGroupCheckChips = (x: any): x is OptionGroupCheckChips => {
  return hasExactKeys(x, ['checkChips', 'submit']);
}

const getDefaultValue = (x: OptionGroupInputs | undefined) => {
  if (isOptionGroupButtons(x)) return x.buttons.defaultValue;
}

const genders = [
  'Man',
  'Woman',
  'Intersex',
  'Non-binary',
  'Transgender',
  'Trans woman',
  'Trans man',
  'Other',
];

const genderOptionGroup: OptionGroup = {
  title: 'Gender',
  description: "What's your gender?",
  input: {
    buttons: {
      values: genders,
      submit: async (input) => true,
    }
  }
};

const otherPeoplesGendersOptionGroup: OptionGroup = {
  title: "Other People's Genders",
  description: "What are the genders of the people you'd like to meet?",
  input: {
    checkChips: genders.map((g) => ({checked: true, label: g})),
    submit: async (inputs: string[]) => true
  }
};

const locationOptionGroup: OptionGroup = {
  title: 'Location',
  description: "What city do you live in?",
  input: {
    locationSelector: {
      submit: async (input: string) => true
    }
  },
  scrollView: false,
};

const orientationOptionGroup: OptionGroup = {
  title: 'Orientation',
  description: "What's your sexual orientation?",
  input: {
    buttons: {
      values: [
        'Straight',
        'Gay',
        'Bisexual',
        'Asexual',
        'Demisexual',
        'Pansexual',
        'Other',
      ],
      submit: async (input: string) => true,
    }
  },
};

const lookingForOptionGroup: OptionGroup = {
  title: 'Looking for',
  description: 'What are you mainly looking for on Duolicious?',
  input: {
    buttons: {
      values: [
        'Long-term dating',
        'Short-term dating',
        'Friends',
      ],
      submit: async (input: string) => true
    }
  }
};

const basicsOptionGroups: OptionGroup[] = [
  genderOptionGroup,
  orientationOptionGroup,
  locationOptionGroup,
  {
    title: 'Occupation',
    description: "What's your profession?",
    input: {
      textShort: {
        submit: async (input: string) => true,
        invalidMsg: 'Try again',
      }
    }
  },
  {
    title: 'Education',
    description: "Where did you study?",
    input: {
      textShort: {
        submit: async (input: string) => true,
        invalidMsg: 'Try again',
      }
    }
  },
  {
    title: 'Height',
    description: "How tall are you?",
    input: {
      slider: {
        sliderMin: 50,
        sliderMax: 220,
        step: 1,
        defaultValue: 170,
        unitsLabel: 'cm',
        submit: async () => true,
      },
    },
  },
  lookingForOptionGroup,
  {
    title: 'Smoking',
    description: 'Do you smoke?',
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: 'Drinking',
    description: 'How often do you drink?',
    input: {
      buttons: {
        values: ['Often', 'Sometimes', 'Never'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: 'Drugs',
    description: 'Do you do drugs?',
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: 'Long Distance',
    description: 'Are you willing to enter a long-distance relationship?',
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: 'Relationship Status',
    description: "What's your relationship status?",
    input: {
      buttons: {
        values: [
          'Single',
          'Seeing someone',
          'Engaged',
          'Married',
          'Divorced',
          'Widowed',
          'Other',
        ],
        submit: async (input: string) => true
      }
    }
  },
  {
    title: 'Has Kids',
    description: 'Do you have kids?',
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: 'Wants Kids',
    description: 'Do you want kids?',
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: 'Exercise',
    description: 'How often do you exercise?',
    input: {
      buttons: {
        values: [
          'Often',
          'Sometimes',
          'Never',
        ],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: 'Religion',
    description: "What's your religion?",
    input: {
      buttons: {
        values: [
          'Agnostic',
          'Atheist',
          'Buddhist',
          'Christian',
          'Hindu',
          'Jewish',
          'Muslim',
          'Other',
        ],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: 'Star Sign',
    description: "What's your star sign?",
    input: {
      buttons: {
        values: [
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
        ],
        submit: async (input: string) => true
      }
    },
  },
];

const generalSettingsOptionGroups: OptionGroup[] = [
  {
    title: 'Units',
    description: "Do you use the metric system, or the imperial system?",
    input: {
      buttons: {
        values: ['Metric', 'Imperial'],
        submit: async (input: string) => true
      }
    }
  },
];

const notificationSettingsOptionGroups: OptionGroup[] = [
  {
    title: 'Chats',
    description: "When do you want to be notified if anyone you're chatting with sends a new message? (\"Daily\" still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: {
        values: [
          'Immediately',
          'Daily',
          'Every 3 Days',
          'Weekly',
          'Never'
        ],
        submit: async (input: string) => true
      }
    }
  },
  {
    title: 'Intros',
    description: "When do you want to be notified if someone you haven't chatted with sends you an intro? (\"Daily\" still sends the first notification of the day immediately, but snoozes later notifications so that you get at-most one notification per 24 hours.)",
    input: {
      buttons: {
        values: [
          'Immediately',
          'Daily',
          'Every 3 Days',
          'Weekly',
          'Never'
        ],
        submit: async (input: string) => true
      }
    }
  },
];

const deletionOptionGroups: OptionGroup[] = [
  {
    title: 'Delete Your Account',
    description: `Are you sure you want to delete your account? This will immediately log you out and permanently delete your account data. If you're sure, type "delete" to confirm.`,
    input: {
      textShort: {
        submit: async (input: string) => {
          if ((input ?? '').trim() !== 'delete') return false;

          const response = await japi('delete', '/account');

          if (!response.ok) return false;

          setSignedInUser(undefined);

          return true;
        },
        invalidMsg: 'Try again',
      }
    }
  },
];

const deactivationOptionGroups: OptionGroup[] = [
  {
    title: 'Deactivate Your Account',
    description: 'Are you sure you want to deactivate your account? This will hide you from other users and log you out. The next time you sign in, your account will be reactivated. Press "continue" to deactivate your account.',
    input: {
      none: {
        submit: async () => {
          const ok = (await japi('post', '/deactivate')).ok
          if (ok) {
            setSignedInUser(undefined);
          }
          return ok;
        }
      }
    }
  },
];

const createAccountOptionGroups: OptionGroup[] = [
  {
    title: "Password",
    description: "Enter the one-time password you just received to create an account or sign in",
    input: {
      otp: {
        submit: async (input) => {
          const existingSessionToken = await sessionToken();
          const response = await japi('post', '/check-otp', { otp: input });

          if (
            response.ok &&
            Boolean(response?.json?.onboarded) &&
            typeof existingSessionToken === 'string'
          ) {
            setSignedInUser((signedInUser) => ({
              personId: response?.json?.person_id,
              units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
              sessionToken: existingSessionToken,
            }));
          }

          return response.ok;
        }
      }
    },
  },
  _.merge(
    {},
    otherPeoplesGendersOptionGroup,
    {
      title: 'Step 1 of 7: ' + otherPeoplesGendersOptionGroup.title,
      input: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { other_peoples_genders: input }
        )).ok
      }
    },
  ),
  _.merge(
    {},
    genderOptionGroup,
    {
      title: 'Step 2 of 7: ' + genderOptionGroup.title,
      input: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { gender: input }
        )).ok
      }
    },
  ),
  {
    title: "Step 3 of 7: First Name",
    description: "What's your first name?",
    input: {
      givenName: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { name: input }
        )).ok
      }
    },
  },
  {
    title: 'Step 4 of 7: Birth Date',
    description: "When were you born?",
    input: {
      date: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { date_of_birth: input }
        )).ok
      }
    },
    scrollView: false,
  },
  _.merge(
    {},
    locationOptionGroup,
    {
      title: 'Step 5 of 7: ' + locationOptionGroup.title,
      input: {
        locationSelector: {
          submit: async (input) => (await japi(
            'patch',
            '/onboardee-info',
            { location: input }
          )).ok
        }
      }
    },
  ),
  {
    title: 'Step 6 of 7: Photos',
    description: 'Profiles with photos are promoted in search results, but you can add these later.',
    input: {
      photos: {
        submit: async (filename, pathOrBase64) => (await mapi(
          'patch',
          '/onboardee-info',
          filename,
          pathOrBase64
        )).ok,
        delete: async (filename) => (await japi(
          'delete',
          '/onboardee-info',
          { files: [filename] }
        )).ok
      }
    }
  },
  {
    title: 'Step 7 of 7: About',
    description: 'Tell us about yourself...',
    input: {
      textLong: {
        submit: async (input) => (await japi(
          'patch',
          '/onboardee-info',
          { about: input }
        )).ok,
        invalidMsg: "Gotta write something",
      }
    }
  },
  {
    title: "You're Looking Like A Snack 😋",
    description: "",
    input: {
      none: {
        description: "You're ready to go! You can always sweeten your profile even more once you're signed in...",
        submit: async () => {
          const response = await japi('post', '/finish-onboarding');
          if (response.ok) {
            setSignedInUser((signedInUser) => ({
              sessionToken: '',
              ...signedInUser,
              personId: response?.json?.person_id,
              units: response?.json?.units === 'Imperial' ? 'Imperial' : 'Metric',
            }));
          };
          return response.ok;
        }
      }
    }
  },
];

const searchBasicsOptionGroups: OptionGroup[] = [
  {
    ...otherPeoplesGendersOptionGroup,
    input: {
      checkChips: [
        ...(
          isOptionGroupCheckChips(otherPeoplesGendersOptionGroup.input) ?
            otherPeoplesGendersOptionGroup.input.checkChips : []),
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
    title: "Gender",
    description: "Which genders would you like to see in search results?",
  },
  {
    title: "Orientation",
    description: "Which orientations would you like to see in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Straight'},
        {checked: true, label: 'Gay'},
        {checked: true, label: 'Bisexual'},
        {checked: true, label: 'Asexual'},
        {checked: true, label: 'Demisexual'},
        {checked: true, label: 'Pansexual'},
        {checked: true, label: 'Other'},
        {checked: true, label: 'Accept Unanswered'},
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Age",
    description: "What ages would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 18,
        sliderMax: 99,
        unitsLabel: 'years',
      }
    },
  },
  {
    title: "Furthest Distance",
    description: "How far away can people be?",
    input: {
      slider: {
        sliderMin: 0,
        sliderMax: 500,
        defaultValue: 50,
        step: 25,
        unitsLabel: 'km',
        addPlusAtMax: true,
        submit: async () => true,
      },
    },
  },
  {
    title: "Height",
    description: "What heights of people would you like to see in search results?",
    input: {
      rangeSlider: {
        sliderMin: 50,
        sliderMax: 220,
        unitsLabel: 'cm',
      },
    },
  },
  {
    title: "Has a Profile Picture",
    description: "Do you want people in search results to have a profile picture?",
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: "Looking for",
    description: "What kind of relationships would you like people in search results to be seeking?",
    input: {
      checkChips: [
        {checked: true, label: 'Long-term dating'},
        {checked: true, label: 'Short-term dating'},
        {checked: true, label: 'Friends'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Smoking",
    description: "Do you want to include people who smoke in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Drinking",
    description: "Do you want to include people who drink alcohol in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Often'},
        {checked: true, label: 'Sometimes'},
        {checked: true, label: 'Never'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Drugs",
    description: "Do you want to include people who take drugs in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Long Distance",
    description: "Do you want search results to include people willing to enter a long-distance relationship?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Relationship Status",
    description: "What relationship statuses are you willing to accept from people in your search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Single'},
        {checked: true, label: 'Seeing someone'},
        {checked: true, label: 'Engaged'},
        {checked: true, label: 'Married'},
        {checked: true, label: 'Divorced'},
        {checked: true, label: 'Widowed'},
        {checked: true, label: 'Other'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Has Kids",
    description: "Do you want search results to include people who had kids?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Wants Kids",
    description: "Do you want search results to include people who want kids?",
    input: {
      checkChips: [
        {checked: true, label: 'Yes'},
        {checked: true, label: 'No'},
        {checked: true, label: 'Accept Unanswered'}
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Exercise",
    description: "Do you want search results to include people who exercise?",
    input: {
      checkChips: [
        {checked: true, label: 'Often'},
        {checked: true, label: 'Sometimes'},
        {checked: true, label: 'Never'},
        {checked: true, label: 'Accept Unanswered'},
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Religion",
    description: "Do you want search results to include people who exercise?",
    input: {
      checkChips: [
        {checked: true, label: 'Agnostic'},
        {checked: true, label: 'Atheist'},
        {checked: true, label: 'Buddhist'},
        {checked: true, label: 'Christian'},
        {checked: true, label: 'Hindu'},
        {checked: true, label: 'Jewish'},
        {checked: true, label: 'Muslim'},
        {checked: true, label: 'Other'},
        {checked: true, label: 'Accept Unanswered'},
      ],
      submit: async (input: string[]) => true
    },
  },
  {
    title: "Star Sign",
    description: "What star signs would you like to see in search results?",
    input: {
      checkChips: [
        {checked: true, label: 'Aquarius'},
        {checked: true, label: 'Aries'},
        {checked: true, label: 'Cancer'},
        {checked: true, label: 'Capricorn'},
        {checked: true, label: 'Gemini'},
        {checked: true, label: 'Leo'},
        {checked: true, label: 'Libra'},
        {checked: true, label: 'Pisces'},
        {checked: true, label: 'Sagittarius'},
        {checked: true, label: 'Scorpio'},
        {checked: true, label: 'Taurus'},
        {checked: true, label: 'Virgo'},
        {checked: true, label: 'Accept Unanswered'},
      ],
      submit: async (input: string[]) => true
    },
  },
];

const searchInteractionsOptionGroups: OptionGroup[] = [
  {
    title: "People You've Messaged",
    description: "Would you like search results to include people you already messaged?",
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: "People You've Hidden",
    description: "Would you like search results to include people you hidden?",
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: "People You've Blocked",
    description: "Would you like to include people you blocked?",
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
];

const hideMeFromStrangersOptionGroup: OptionGroup = {
  title: 'Hide Me From Strangers',
  description: "If you'd rather be the one who makes the first move, you can show your profile only to people who you've messaged. With this option set to 'Yes', people won't be able to see you anywhere in Duolicious until you message them.",
  input: {
    buttons: {
      values: ['Yes', 'No'],
      submit: async (input: string) => true
    }
  },
};

const privacySettingsOptionGroups: OptionGroup[] = [
  {
    title: 'Show My Location',
    description: "Would you like your location to appear on your profile? Note that if you set this option to 'No', other people will still be able to filter your profile by distance when searching.",
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  {
    title: 'Show My Age',
    description: "Would you like your age to appear on your profile? Note that if you set this option to 'No', other people will still be able to filter your profile by age when searching.",
    input: {
      buttons: {
        values: ['Yes', 'No'],
        submit: async (input: string) => true
      }
    },
  },
  hideMeFromStrangersOptionGroup,
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
  basicsOptionGroups,
  createAccountOptionGroups,
  deactivationOptionGroups,
  deletionOptionGroups,
  generalSettingsOptionGroups,
  getDefaultValue,
  hideMeFromStrangersOptionGroup,
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
  notificationSettingsOptionGroups,
  privacySettingsOptionGroups,
  searchBasicsOptionGroups,
  searchInteractionsOptionGroups,
};
