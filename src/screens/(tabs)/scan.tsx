import React, { useState, useRef, useContext } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { EncodingType, readAsStringAsync } from 'expo-file-system';
import { LeafList, useLeaf } from '@/providers/leaf-provider';
import { AuthContext } from '@/providers/auth-provider';
import { base64ToUint8Array } from '@/functions/base64ToUint8Array';
import axios from 'axios';

interface Result {
  image: string;
  results: {
    class: number;
    confidence: number;
    bbox: number[];
  }[];
}

interface ProcessResult {
  disease: {
    class: string;
    confidence: number;
  };
  severities: {
    className: string;
    confidence: number;
  };
}

export default function ScanScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [image, setImage] = useState<string | undefined>();
  const [result, setResult] = useState<Result>();
  const [processResult, setProcessResult] = useState<ProcessResult>();
  const context = useLeaf();
  const user = useContext(AuthContext);

  const resizeImage = async (imagePath: string) => {
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

      // Convert base64 to Uint8Array
      const uint8Array = base64ToUint8Array(base64);

      return {
        ...manipulateResult,
        base64,
        uint8Array,
      };
    } catch (error) {
      console.error('Error resizing image:', error);
      throw error;
    }
  };

  const analyzeImage = async (
    base64Image: string,
  ): Promise<Result | undefined> => {
    try {
      const response = await axios.post('http://192.168.1.2:5001/predict', {
        image: `data:image/png;base64,${base64Image}`,
      });

      return {
        results: response.data.results,
        image: response.data.image,
      };
    } catch (err) {
      console.error(err);
    }
  };

  function processResults(process: Result['results']) {
    console.log(process);
    const leafClassNames = ['Cercospora', 'Coffee Rust', 'Phoma'];
    const leafClassIndex = [0, 1, 4];

    const severityClassNames = ['Low', 'Moderate', 'Severe', 'Mild'];
    const severityClassIndex = [2, 3, 5, 6];

    // First, let's fix the confidence mapping in transpose
    const transpose = process.map(response => {
      const classIndex = response.class;
      return {
        bbox: response.bbox,
        class: leafClassIndex.includes(classIndex)
          ? leafClassIndex.indexOf(classIndex)
          : severityClassIndex.indexOf(classIndex),
        confidence: response.confidence, // Fixed: was using bbox instead of confidence
      };
    });

    // Filter detections by leaf classes
    const leafDetections = transpose.filter(item =>
      leafClassIndex.includes(process[transpose.indexOf(item)].class),
    );

    // Filter detections by severity classes
    const severityDetections = transpose.filter(item =>
      severityClassIndex.includes(process[transpose.indexOf(item)].class),
    );

    // Calculate average confidence for leaf detections and get the most likely class
    let dominantLeafDisease = null;
    if (leafDetections.length > 0) {
      const leafConfidenceMap = new Map<
        number,
        { sum: number; count: number }
      >();

      leafDetections.forEach(detection => {
        const currentData = leafConfidenceMap.get(detection.class) || {
          sum: 0,
          count: 0,
        };
        leafConfidenceMap.set(detection.class, {
          sum: currentData.sum + detection.confidence,
          count: currentData.count + 1,
        });
      });

      let highestAvgConfidence = 0;
      let mostLikelyClass = 0;

      leafConfidenceMap.forEach((value, classIndex) => {
        const avgConfidence = value.sum / value.count;
        if (avgConfidence > highestAvgConfidence) {
          highestAvgConfidence = avgConfidence;
          mostLikelyClass = classIndex;
        }
      });

      dominantLeafDisease = {
        class: leafClassNames[mostLikelyClass],
        confidence: highestAvgConfidence,
      };
    }

    // Map severity detections to their class names
    let dominantSeverity = null;
    if (severityDetections.length > 0) {
      const highestConfidenceSeverity = severityDetections.reduce(
        (prev, current) =>
          prev.confidence > current.confidence ? prev : current,
      );

      dominantSeverity = {
        className: severityClassNames[highestConfidenceSeverity.class],
        confidence: highestConfidenceSeverity.confidence,
      };
    }

    return {
      disease: dominantLeafDisease!,
      severities: dominantSeverity!,
    };
  }

  const handleScan = async () => {
    if (!camera.current || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);

      // Capture photo
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableAutoRedEyeReduction: false,
      });

      setImage(photo.path);

      const resizedPhoto = await resizeImage(`file://${photo.path}`);

      const response = await analyzeImage(resizedPhoto.base64);

      if (response !== undefined) {
        setResult(response);

        const process = processResults(response.results);
        console.log(process);
        setProcessResult(process);
      }
    } catch (error) {
      console.error('Error during scan:', error);
      clean();
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const clean = () => {
    setResult(undefined);
    setImage(undefined);
    setProcessResult(undefined);
  };

  if (!hasPermission) {
    requestPermission();
  }

  return (
    <View className="flex-1 flex-col items-center justify-center rounded-3xl my-4">
      {image === undefined && (
        <View className="w-[400px] h-[450px] mt-16 items-center">
          <Camera
            ref={camera}
            photo={true}
            style={StyleSheet.absoluteFill}
            device={device!}
            isActive={true}
            resizeMode="contain"
          />
        </View>
      )}

      {image !== undefined && result === undefined && (
        <Image
          source={{ uri: `file://${image}` }}
          className="w-[400px] h-[450px] mt-16 items-center rounded-md p-4"
        />
      )}

      {result !== undefined && (
        <Image
          source={{ uri: result?.image }}
          className="w-[400px] h-[450px] mt-16 items-center rounded-md p-4 mb-16"
        />
      )}

      {processResult !== undefined && (
        <View className="flex flex-col gap-4">
          <Text className="font-medium text-primary text-3xl">
            Disease Name:{' '}
            <Text className="font-normal">{processResult.disease.class}</Text>
          </Text>
          <Text className="font-medium text-primary text-3xl">
            Severity:{' '}
            <Text className="font-normal">
              {((processResult.severities.confidence as number) * 100).toFixed(
                2,
              ) + '%'}
            </Text>
          </Text>
          <Text className="font-medium text-primary text-3xl">
            Rating Label:{' '}
            <Text className="font-normal">
              {processResult.severities.className}
            </Text>
          </Text>
        </View>
      )}
      {result !== undefined && (
        <View className="flex flex-row items-center justify-center gap-4 w-full mt-6">
          <Button
            mode="contained"
            onPress={clean}
            disabled={isProcessing}
            buttonColor="#3E735B"
            textColor="#fff">
            Re-scan
          </Button>

          <Button
            mode="contained"
            onPress={async () => {
              if (processResult !== undefined) {
                const leaf: LeafList = {
                  image: result.image,
                  diseasename: processResult.disease.class,
                  severity: processResult.severities.confidence * 100,
                  label: processResult.severities.className,
                  user: user.user!.id,
                };

                await context.addLeaf(leaf);
                clean();
              }
            }}
            disabled={isProcessing}
            buttonColor="#3E735B"
            textColor="#fff">
            Save
          </Button>
        </View>
      )}
      {result === undefined && (
        <Text className="mt-16">
          {isProcessing ? 'Processing...' : 'Ready to scan'}
        </Text>
      )}
      {result === undefined && (
        <View className="w-full px-16 mt-32 mb-32">
          <Button
            mode="contained"
            onPress={handleScan}
            disabled={isProcessing}
            buttonColor="#3E735B"
            textColor="#fff">
            {isProcessing ? 'Processing...' : 'Scan'}
          </Button>
        </View>
      )}
    </View>
  );
}
