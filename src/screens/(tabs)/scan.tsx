import { CustomContainer } from '@/components';
import React, { useState, useEffect, useRef, useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
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
import DetectionCanvas from '@/components/detection-view';
import axios from 'axios';

interface ScanResult {
  segmentation: {
    type: 'normal' | 'disease' | 'biotic';
    confidence: number;
    details?: string;
  };
  classifier: {
    class: string;
    confidence: number | bigint;
    index: number;
  };
}

export default function ScanScreen() {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [models, setModels] = useState<TensorflowModel>();
  const [results, setResults] = useState<ScanResult | null>(null);
  const [image, setImage] = useState<string | undefined>();
  const [resizedImage, setReizedImage] = useState('');
  const context = useLeaf();
  const user = useContext(AuthContext);
  const [processed, setProcessed] = useState<
    {
      classId: number;
      bbox: number[];
      confidence: number;
    }[]
  >();

  // Load models on component mount
  useEffect(() => {
    async function loadModels() {
      setIsModelLoading(true);
      try {
        const resnetModel = await loadTensorflowModel(
          require('../../../assets/models/best_float32.tflite'),
        );

        setModels(resnetModel);
        setIsModelLoading(false);
      } catch (error) {
        console.error('Error loading models:', error);
      }
    }

    loadModels();
  }, []);

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

  const analyzeImage = async (base64Image: string) => {
    try {
      const response = await axios.post('http://192.168.1.6:5001/predict', {
        image: `data:image/png;base64,${base64Image}`,
      });

      console.log('result: ', response.data);

      return {
        result: response.data.results,
        image: response.data.image,
      };
    } catch (err) {
      console.error(err);
    }
  };

  const handleScan = async () => {
    if (!camera.current || isProcessing) {
      return;
    }

    if (models === undefined) {
      return;
    }

    try {
      setIsProcessing(true);

      // Capture photo
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableAutoRedEyeReduction: false,
      });

      const resizedPhoto = await resizeImage(`file://${photo.path}`);

      setReizedImage(resizedPhoto.base64);
      setImage(resizedPhoto.base64);

      const response = await analyzeImage(resizedPhoto.base64);
      console.log(response?.result);
      clean();
    } catch (error) {
      console.error('Error during scan:', error);
      clean();
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const getSeverity = (percentage: number) => {
    if (percentage < 10) {
      return 'Low';
    }
    if (percentage < 25) {
      return 'Mild';
    }
    if (percentage < 50) {
      return 'Moderate';
    }
    return 'Severe';
  };

  const clean = () => {
    setResults(null);
    setImage(undefined);
    setProcessed(undefined);
  };

  if (!hasPermission) {
    requestPermission();
  }

  if (isModelLoading) {
    return (
      <CustomContainer>
        <View className="flex-1 items-center justify-center">
          <Text>Loading...</Text>
        </View>
      </CustomContainer>
    );
  }

  // const onDismissSnackBar = () => setSnackBarVisible(false);

  return (
    <View className="flex-1 flex-col items-center justify-center rounded-3xl my-4">
      {processed === undefined && (
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

      {processed !== undefined && (
        <DetectionCanvas
          base64Image={resizedImage}
          detections={processed}
          width={640}
          height={640}
        />
      )}

      {/* {results !== null && (
        <View className="flex flex-col gap-4">
          <Text className="font-medium text-primary text-3xl">
            Disease Name:{' '}
            <Text className="font-normal">{results?.classifier.class}</Text>
          </Text>
          <Text className="font-medium text-primary text-3xl">
            Severity Name:{' '}
            <Text className="font-normal">
              {((results?.segmentation.confidence as number) * 100).toFixed(2) +
                '%'}
            </Text>
          </Text>
          <Text className="font-medium text-primary text-3xl">
            Rating Label:{' '}
            <Text className="font-normal">
              {getSeverity((results?.segmentation.confidence as number) * 100)}
            </Text>
          </Text>
        </View>
      )} */}

      {processed !== undefined && (
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
              const leaf: LeafList = {
                image: resizedImage,
                diseasename: results!.classifier.class,
                severity: (results?.segmentation.confidence as number) * 100,
                label: getSeverity(
                  (results?.segmentation.confidence as number) * 100,
                ),
                user: user.user!.id,
              };

              await context.addLeaf(leaf);
              clean();
            }}
            disabled={isProcessing}
            buttonColor="#3E735B"
            textColor="#fff">
            Save
          </Button>
        </View>
      )}

      {results === null && (
        <Text className="mt-16">
          {isProcessing ? 'Processing...' : 'Ready to scan'}
        </Text>
      )}

      {image === undefined && (
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
