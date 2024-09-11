"use client";

import React, { useLayoutEffect, useState } from 'react';
import axios from 'axios';

interface Item {
  ID: { S: string };
  Name: { S: string };
  Password: { S: string };
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const fileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const upload = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // デフォルトのボタン動作をキャンセル
    event.preventDefault();

    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    try {
      // axiosでJWTトークンを取得し、sessionStorageに保存する
      axios.get('https://localhost/api/jwt') // GoのJWTエンドポイントにリクエスト
        .then(response => {
          const token = response.data.jwt; // レスポンスからJWTトークンを取得
          console.log('Received JWT token:', token);

          // JWTトークンをsessionStorageに保存
          sessionStorage.setItem('jwtToken', token);

          // 保存したトークンを確認
          console.log('JWT token saved in sessionStorage:', sessionStorage.getItem('jwtToken'));
        })
        .catch(error => {
          console.error('Error fetching JWT token:', error);
        });

      // サーバーからCSRFトークンを取得
      const csrfResponse = await axios.get('https://localhost/api/csrf', { withCredentials: true });
      const csrfToken = csrfResponse.data.csrf_token;

      const formData = new FormData();
      formData.append('pdfFile', selectedFile);

      // ファイルアップロードのPOSTリクエストを送信
      const response = await axios.post('https://localhost/api/upload', formData, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem("jwtToken")}`,
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

  const download = async (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    // デフォルトのボタン動作をキャンセル
    event.preventDefault();

    const response = await axios.get('https://localhost/api/download', {
      responseType: 'blob',
      params: {
        id: id
      }
    })

    // Blobを使ってURLを作成
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const urlObject = URL.createObjectURL(blob);

    // 新しいタブでPDFを表示
    window.open(urlObject);
  }

  const oauth2TokenFetch = async () => {
    try {
      const response = await axios.get('https://localhost/api/oauth2TokenCheck'); 
      sessionStorage.setItem('access_token',response.data.access_token);
    } catch (error) {
      console.error('Error fetching token:', error);
    }
  };

  const getAllItems = async () => {
    try {
      const response = await axios.get('https://localhost/api/file/items');
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useLayoutEffect(
      () => {
        oauth2TokenFetch();
        
        if (sessionStorage.getItem('access_token') == null) {
          window.location.href = 'https://localhost/auth';
        }

        getAllItems();
      },
  []
  );

  return (
  <>
  <div className="bg-white py-6 sm:py-8 lg:py-12">
    <div className="mx-auto max-w-screen-2xl px-4 md:px-8">
      <div className="mb-10 md:mb-16">
        <h2 className="mb-4 text-center text-2xl font-bold text-gray-800 md:mb-6 lg:text-3xl">fyfy</h2>
        <p className="mx-auto max-w-screen-md text-center text-gray-500 md:text-lg mb-10">
          ユーザーがファイルをアップロードし、特定の人と安全に共有できるプラットフォーム。<br/>
          ファイルは暗号化され、アクセス制御が厳密に管理される。
        </p>
        <div  className="mx-auto max-w-screen-md text-center md:text-lg">
          <input className="mb-10 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400" id="file_input" type="file" onChange={fileSelect} />
          <button type="submit" onClick={upload} className='text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'>
            Upload
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 xl:gap-8">
        {items.map((item, index) => (
          <div className="flex flex-col overflow-hidden rounded-lg border bg-white">
            <a href="#" className="group relative block h-48 overflow-hidden bg-gray-100 md:h-64">
              <img src="https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&q=75&fit=crop&w=600" loading="lazy" alt="Photo by Minh Pham" className="absolute inset-0 h-full w-full object-cover object-center transition duration-200 group-hover:scale-110" />
            </a>
            <div className="flex flex-1 flex-col p-4 sm:p-6">
              <h2 className="mb-2 text-lg font-semibold text-gray-800">
                <a href="#" className="transition duration-100 hover:text-indigo-500 active:text-indigo-600">{item.Name.S}</a>
              </h2>
              <p className="mb-8 text-gray-500">{item.ID.S}</p>
              <div className="mt-auto flex items-end justify-between">
                <button onClick={(event) => download(event, item.ID.S)} className='py-2.5 px-5 me-2 mb-2 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700'>
                  Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
  </>
  );
}
