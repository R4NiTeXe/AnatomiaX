import { useState } from 'react';
import type { JSX } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import type { AnatomyBodyModelKey } from '@anatomiax/shared-types';

/**
 * Minimal learning placeholder. Uses shared-types for the body-model domain
 * (no duplicated DTOs) and deliberately does NOT port the 3D viewer yet.
 */
const BODY_MODELS: AnatomyBodyModelKey[] = ['male', 'female'];

export default function LearningScreen(): JSX.Element {
  const [bodyModel, setBodyModel] = useState<AnatomyBodyModelKey>('male');

  return (
    <View style={styles.container} testID="mobile-learning-screen">
      <Text style={styles.title}>Learn</Text>
      <Text testID="mobile-learning-bodymodel">Body model: {bodyModel}</Text>
      <View style={styles.row}>
        {BODY_MODELS.map(model => (
          <View key={model} style={styles.button}>
            <Button
              title={model}
              onPress={() => setBodyModel(model)}
              testID={`mobile-learning-${model}`}
            />
          </View>
        ))}
      </View>
      <Text style={styles.placeholder}>
        The interactive 3D anatomy viewer arrives in a later step. Progress and quizzes reuse the
        same `/api/v1/progress` contract as web.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  button: { flex: 1 },
  placeholder: { opacity: 0.7 },
});
