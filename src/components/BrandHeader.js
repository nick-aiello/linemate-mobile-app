import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../api/client';

export default function BrandHeader({ teamId, teamName, primaryColor = '#c0392b' }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: primaryColor, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Image
          source={{ uri: `${BASE_URL}/${teamId}/logo/main` }}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.name} numberOfLines={1}>{(teamName || '').toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  content: { alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
  logo: { width: 64, height: 64, marginBottom: 6 },
  name: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
});
