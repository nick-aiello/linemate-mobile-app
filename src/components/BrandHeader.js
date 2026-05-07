import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../api/client';

export default function BrandHeader({ teamId, pageName, primaryColor = '#c0392b' }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: primaryColor, paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Image
          source={{ uri: `${BASE_URL}/${teamId}/logo/main` }}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.pageName} numberOfLines={1}>{(pageName || '').toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  logo: { width: 56, height: 56 },
  pageName: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 2 },
});
