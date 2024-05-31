  import { useEffect, useState } from "react";
  import { DefaultText } from "./default-text";
  import { View, LayoutChangeEvent, StyleSheet, Text, Linking, TouchableOpacity } from "react-native";
  import { ActivityIndicator } from "react-native";

  interface EmbedData {
    embedCode?: string;
    videoTitle?: string;
    uploader?: string;
  }

  interface Dimensions {
    width: number;
    height: number;
  }
  
  const YouTubePlayer = ({ videoId }: { videoId: string}) => {
    const [embedData, setEmbedData] = useState<EmbedData>({
      embedCode: undefined,
      videoTitle: undefined,
      uploader: undefined,
    });

    const [dimensions, setDimensions] = useState<Dimensions | null>(null);
    const [isFetchingComplete, setIsFetchingComplete] = useState(false);

    useEffect(() => {
      if (!isFetchingComplete && dimensions) {
        const fetchYouTubeEmbed = async (videoId: string, width: number, height: number) => {
          try {
            const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json&maxwidth=${Math.floor(width)}&maxheight=${Math.floor(height)}`;
          
            const response = await fetch(url);
          
            if (!response.ok) {
              throw new Error(`YouTube network response was not ok: ${response.statusText}`);
            }

            const data = await response.json();

            setEmbedData({
              embedCode: data.html,
              videoTitle: data.title,
              uploader: data.author_name,
            });
          } catch (error) {
            console.error("Error fetching YouTube embed:", error);

            setEmbedData({
              embedCode: undefined,
              videoTitle: undefined,
              uploader: undefined,
            });
          } finally {
            setIsFetchingComplete(true);
          }
        };
      
        fetchYouTubeEmbed(videoId, dimensions.width, dimensions.height);
      }
    }, [videoId, dimensions, isFetchingComplete]);

  const handleLayout = (event: LayoutChangeEvent) => {
    if (!dimensions) {
      const { width } = event.nativeEvent.layout;
      const height = (width * 240) / 320;
      setDimensions({ width, height });
    }
  };

    return (
      <View
        onLayout={handleLayout}
        pointerEvents="box-none"
        style={styles.container}
      >
        {!isFetchingComplete && dimensions ? (
          <View style={[styles.loadingContainer, { width: dimensions.width, height: dimensions.height }]}>
            <ActivityIndicator size="small" color="#70f" />
          </View>
        ) : (
          <View style={styles.innerContainer}>
            <DefaultText>
              <View style={styles.textContainer}>
                <Text style={styles.youtubeText}>YouTube</Text>
                <Text style={styles.uploaderText}>{embedData.uploader}</Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://youtube.com/watch?v=${videoId}`)}
                >
                  <Text style={[styles.videoTitle]}>
                    {embedData.videoTitle}
                  </Text>
                </TouchableOpacity>
              </View>
            </DefaultText>
            <View style={styles.embedContainer}>
              <div
                dangerouslySetInnerHTML={{ __html: embedData.embedCode || "" }}
              />
            </View>
          </View>
        )}
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#d2d3db",
      borderRadius: 10,
      overflow: "hidden",
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    innerContainer: {
      flex: 1,
    },
    textContainer: {
      padding: 10,
    },
    youtubeText: {
      margin: 0,
      paddingBottom: 5,
      fontSize: 9,
    },
    uploaderText: {
      fontSize: 12,
      margin: 0,
      paddingBottom: 5,
      fontWeight: "bold",
    },
    videoTitle: {
      textDecorationLine: "none",
      color: "#206694",
      fontWeight: "bold",
    },
    embedContainer: {
      marginRight: 10,
      marginBottom: 10,
      marginLeft: 10,
      maxWidth: "100%",
      overflow: "hidden",
    },
  });

  export {
    YouTubePlayer,
  };
