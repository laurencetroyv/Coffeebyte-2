import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { EncodingType, readAsStringAsync } from 'expo-file-system';

export const resizeImage = async (imagePath: string) => {
  try {
    const manipulateResult = await manipulateAsync(
      imagePath,
      [
        {
          resize: {
            width: 640,
            height: 640,
          },
        },
      ],
      {
        compress: 0.8,
        format: SaveFormat.JPEG,
      },
    );
    // Convert the resized image to base64
    const base64 = await readAsStringAsync(manipulateResult.uri, {
      encoding: EncodingType.Base64,
    });

    return {
      ...manipulateResult,
      base64,
    };
  } catch (error) {
    throw error;
  }
};
