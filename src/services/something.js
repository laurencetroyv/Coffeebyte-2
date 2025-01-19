import React, { useState } from 'react';
import {
  View,
  Button,
  Text,
  ActivityIndicator,
  PermissionsAndroid,
  TouchableOpacity,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { Client, Storage } from 'appwrite';

const UploadComponent = () => {
  const client = new Client();
  client
    .setEndpoint('https://cloud.appwrite.io/v1') // Replace with your Appwrite endpoint
    .setProject('676cc024000ad5ed402a'); // Replace with your Appwrite project ID

  const storage = new Storage(client);

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // Store selected file
  const [uploadResponse, setUploadResponse] = useState(null);

  // Request permissions for Android
  const requestPermissions = async () => {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'We need access to your storage to upload files.',
      },
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      console.log('Permission denied');
      return false;
    }
    return true;
  };

  // File selection handler
  const handleFileSelection = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf], // Restrict to PDF files
      });
      setSelectedFile(res);
      console.log('File selected:', res);
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User canceled file selection.');
      } else {
        console.error('File selection error:', err);
      }
    }
  };

  // File upload handler
  // const uploadFile = async () => {
  //   if (!selectedFile) {
  //     alert("Please select a PDF file first.");
  //     return;
  //   }

  //   try {
  //     setUploading(true); // Show loader during upload

  //     const fileId = ID.unique(); // Generate a unique file ID
  //     const fileData = new FormData();
  //     fileData.append("file", {
  //       uri: selectedFile.uri,
  //       name: selectedFile.name,
  //       type: selectedFile.type,
  //     });

  //     const response = await fetch(
  //       `https://cloud.appwrite.io/v1/storage/buckets/pdfs_bucket1/files/${fileId}`,
  //       {
  //         method: "POST",
  //         headers: {
  //           "X-Appwrite-Project": "676cc024000ad5ed402a", // Replace with your Appwrite project ID
  //           'X-Appwrite-Key': 'standard_91e2870566128f764e151428f14816304459b90980da1bbca871b6dba21eb0889cd020eb1996a53da3952b12c3948c3a9913c481eca5c96e1859bbcd8f81ab6d7c47304dd34078b4d656ec21d1b01328f2657956e42f36ec7f32f23f7cba6f4a7ee4587937c1e205eac84d022f2c210a8d3be7cb011a659f412f2301ded98ddf', // Your Appwrite API key
  //         },
  //         body: fileData,
  //       }
  //     );

  //     const responseBody = await response.json();
  //     console.log("Upload Response:", responseBody);

  //     if (!response.ok) {
  //       throw new Error(`Upload failed: ${responseBody.message || "Unknown error"}`);
  //     }

  //     setUploadResponse(responseBody);
  //     alert("File uploaded successfully!");
  //   } catch (err) {
  //     console.error("Upload error:", err.message);
  //     alert(`Upload failed: ${err.message}`);
  //   } finally {
  //     setUploading(false); // Hide loader
  //   }
  // };

  const uploadFile = async () => {};

  return (
    <View style={{ padding: 20 }}>
      {uploading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <>
          <TouchableOpacity
            onPress={async () => {
              const hasPermission = await requestPermissions();
              if (hasPermission) handleFileSelection();
            }}
            style={{
              padding: 10,
              backgroundColor: '#eee',
              borderRadius: 5,
              marginBottom: 10,
            }}>
            <Text>Select PDF File</Text>
          </TouchableOpacity>

          {selectedFile && (
            <Text style={{ marginBottom: 10 }}>
              Selected File: {selectedFile.name}
            </Text>
          )}

          <Button title="Upload PDF" onPress={uploadFile} />
        </>
      )}
      {uploadResponse && (
        <Text style={{ marginTop: 20 }}>
          Uploaded File ID: {uploadResponse.$id}
        </Text>
      )}
    </View>
  );
};
