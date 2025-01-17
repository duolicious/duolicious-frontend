import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  timestamp: Date;
};

const MessageDivider = ({ timestamp }: Props) => {
  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.lineContainer}>
        <View style={styles.line} />
        <Text style={styles.text}>{formatDate(timestamp)}</Text>
        <View style={styles.line} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    width: '100%',
  },
  lineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#4f545c',
  },
  text: {
    fontSize: 12,
    color: '#72767d',
    fontWeight: '600',
    marginHorizontal: 8,
    textTransform: 'uppercase',
  },
});

export default MessageDivider;