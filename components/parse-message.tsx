  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { Text, Linking, Alert, Platform } from 'react-native';

  const CONFIRMED_DOMAINS_KEY = 'confirmedDomains';

  const ParseMessage = (text, id, checkEmbed, updateEmbed) => {
    const embedRegex = [
      { id: 'youtube', regex: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/ }
      // You can add more embed types here following the same pattern
    ];
    const urlRegex = /(https?:\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
    const emojiRegex = /^[\uD800-\uDBFF][\uDC00-\uDFFF]$/;

    const handleEmbeds = (part) => {
      const embedResult = embedRegex.find(({ regex }) => regex.test(part)); // Go through every single embed regex to find a match
      if (embedResult && !checkEmbed(id)) {
        const match = part.match(embedResult.regex);
        updateEmbed(id, embedResult.id, match.slice(1));
      }
    };

  // Function to render each part of the text
  const renderPart = (part, index) => {
    if (urlRegex.test(part)) {
      // If part matches a URL, handle embeds and render a clickable link
      handleEmbeds(part);

      return (
        <Text
          key={part}
          style={{ textDecorationLine: 'underline' }}
          onPress={() => openUrlWithConfirmation(part)}
        >
          {part}
        </Text>
      );
    } else if (emojiRegex.test(part)) {
      // If the message is just a single emoji, render it with a larger font size
      return <Text key={index} style={{ fontSize: 48 }}>{part}</Text>;
    } else {
      // Matched no special cases, so render it as plain text
      return <Text key={index}>{part}</Text>;
    }
  };

  // Split the text into parts
  const parts = text.split(urlRegex);
  // Map over each part and render it using the renderPart function
  return parts.map(renderPart);
  };

  const getDomainFromUrl = (url) => {
    const { hostname } = new URL(url);
    // Remove 'www.' prefix if present
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  };

  const openUrlWithConfirmation = async (url) => {
    try {
      const domain = getDomainFromUrl(url);
      // Retrieve confirmed domains from AsyncStorage
      const storedDomains = await AsyncStorage.getItem(CONFIRMED_DOMAINS_KEY);
      const confirmedDomains = storedDomains ? JSON.parse(storedDomains) : [];

      // If the domain is already confirmed, open the URL directly
      if (confirmedDomains.includes(domain)) {
        if (Platform.OS === 'web') {
          window.open(url, '_blank');
        } else {
          Linking.openURL(url);
        }
        return;
      }

  const confirmAction = async () => {
        const updatedDomains = [...confirmedDomains, domain];
        await AsyncStorage.setItem(CONFIRMED_DOMAINS_KEY, JSON.stringify(updatedDomains));
        if (Platform.OS === 'web') {
          window.open(url, '_blank');
        } else {
          Linking.openURL(url);
        }
      };

      if (Platform.OS === 'web') {
        const userConfirmed = window.confirm(`Do you trust the domain ${domain}?`);
        if (userConfirmed) {
          await confirmAction();
        }
      } else {
        // Use Alert for iOS and Android
        Alert.alert(
          'Open URL',
          `Do you trust the domain ${domain}?`,
          [
            {
              text: 'No',
              style: 'cancel',
            },
            {
              text: 'Yes',
              onPress: confirmAction,
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      console.error('Error handling URL confirmation:', error);
    }
  };

  export { 
    ParseMessage,
  };
