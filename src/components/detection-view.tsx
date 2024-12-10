import React, { Fragment } from 'react';
import { Canvas, Image, Path, Skia, Text } from '@shopify/react-native-skia';
import { View } from 'react-native';

const classes = [
  'Cercospora',
  'Coffee Rust',
  'Low',
  'Moderate',
  'Phoma',
  'Severe',
  'Mild',
];

interface DetectionCanvasProps {
  base64Image: string;
  detections: {
    bbox: number[];
    classId: number;
    confidence: number;
  }[];
  width: number;
  height: number;
}

const DetectionCanvas = ({
  base64Image,
  detections,
  width,
  height,
}: DetectionCanvasProps) => {
  const data = Skia.Data.fromBase64(base64Image);
  const image = Skia.Image.MakeImageFromEncoded(data);
  console.log(detections.length);

  if (!image) {
    console.log('Image not loaded yet');
    return <View style={{ width, height, backgroundColor: 'gray' }} />;
  }

  return (
    <Canvas style={{ width: width, height: height }}>
      <Image image={image} fit="contain" width={width} height={height} />
      {detections.map((detection, i) => {
        const [x_center, y_center, box_width, box_height] = detection.bbox;
        const x = x_center - box_width / 2;
        const y = y_center - box_height / 2;
        const label = classes[detection.classId];
        const color =
          label === 'Severe'
            ? '#ff0000'
            : label === 'Moderate'
            ? '#ffa500'
            : label === 'Mild' || label === 'Low'
            ? '#ffff00'
            : '#00ff00';

        // console.log(label);

        return (
          <Fragment key={i}>
            <Path
              path={`M ${x} ${y} h ${box_width} v ${box_height} h ${-box_width} Z`}
              style="stroke"
              color={color}
              strokeWidth={4}
            />
            <Text
              x={x * width}
              y={y * height - 10}
              text={`${label} ${(detection.confidence * 100).toFixed(1)}%`}
              color={color}
              font={Skia.Font()}
            />
          </Fragment>
        );
      })}
    </Canvas>
  );
};

export default DetectionCanvas;
