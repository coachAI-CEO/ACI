import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  message: string;
};

export function ErrorMessage({ message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a1013',
    borderColor: '#7f1d1d',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  message: {
    color: '#fca5a5',
    fontSize: 13,
  },
});
