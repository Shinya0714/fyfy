"use client";

import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Item {
  ID: { S: string };
  Name: { S: string };
  Password: { S: string };
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const submit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // デフォルトのボタン動作をキャンセル
    event.preventDefault();

    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    try {
      // サーバーからCSRFトークンを取得
      const csrfResponse = await axios.get('http://localhost/api/token', { withCredentials: true });
      const csrfToken = csrfResponse.data.csrf_token;

      const formData = new FormData();
      formData.append('pdfFile', selectedFile);

      // ファイルアップロードのPOSTリクエストを送信
      const response = await axios.post('http://localhost/api/upload', formData, {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        withCredentials: true
      });

      if (response.status !== 200) {
        throw new Error('Failed to upload file');
      }

      alert('パスワードを生成しました\n\n' + response.data.Password.S);

      getAllItems();
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const getAllItems = async () => {
    try {
      const response = await axios.get('http://localhost/api/file/items');
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };


  useEffect(
      () => {
        getAllItems();
      },
  []
  );

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button type="submit" onClick={submit}>Submit</button>
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <strong>ID:</strong> {item.ID.S} <br />
            <strong>Name:</strong> {item.Name.S} <br />
          </li>
        ))}
      </ul>
    </div>
  );
}
