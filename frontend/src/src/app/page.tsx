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
      sessionStorage.setItem('auth_token',response.data.access_token);
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
        
        if (sessionStorage.getItem('auth_token') == null) {
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
      {/* <!-- text - start --> */}
      <div className="mb-10 md:mb-16">
        <h2 className="mb-4 text-center text-2xl font-bold text-gray-800 md:mb-6 lg:text-3xl">fyfy</h2>

        <p className="mx-auto max-w-screen-md text-center text-gray-500 md:text-lg">
          ユーザーがファイルをアップロードし、特定の人と安全に共有できるプラットフォーム。<br/>
          ファイルは暗号化され、アクセス制御が厳密に管理される。
        </p>
        
        <input type="file" onChange={fileSelect} />
        <button type="submit" onClick={upload}>Upload</button>
        <ul>
          {items.map((item, index) => (
            <li key={index}>
              <strong>ID:</strong> {item.ID.S} <br />
              <strong>Name:</strong> {item.Name.S} <br />
              <button onClick={(event) => download(event, item.ID.S)}>Download</button>
            </li>
          ))}
        </ul>
      </div>
      {/* <!-- text - end --> */}

      <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 xl:gap-8">
        {/* <!-- article - start --> */}
        <div className="flex flex-col overflow-hidden rounded-lg border bg-white">
          <a href="#" className="group relative block h-48 overflow-hidden bg-gray-100 md:h-64">
            <img src="https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&q=75&fit=crop&w=600" loading="lazy" alt="Photo by Minh Pham" className="absolute inset-0 h-full w-full object-cover object-center transition duration-200 group-hover:scale-110" />
          </a>

          <div className="flex flex-1 flex-col p-4 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">
              <a href="#" className="transition duration-100 hover:text-indigo-500 active:text-indigo-600">New trends in Tech</a>
            </h2>

            <p className="mb-8 text-gray-500">This is a section of some simple filler text, also known as placeholder text. It shares some characteristics of a real written text.</p>

            <div className="mt-auto flex items-end justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  <img src="https://images.unsplash.com/photo-1611898872015-0571a9e38375?auto=format&q=75&fit=crop&w=64" loading="lazy" alt="Photo by Brock Wegner" className="h-full w-full object-cover object-center" />
                </div>

                <div>
                  <span className="block text-indigo-500">Mike Lane</span>
                  <span className="block text-sm text-gray-400">July 19, 2021</span>
                </div>
              </div>

              <span className="rounded border px-2 py-1 text-sm text-gray-500">Article</span>
            </div>
          </div>
        </div>
        {/* <!-- article - end --> */}

        {/* <!-- article - start --> */}
        <div className="flex flex-col overflow-hidden rounded-lg border bg-white">
          <a href="#" className="group relative block h-48 overflow-hidden bg-gray-100 md:h-64">
            <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&q=75&fit=crop&w=600" loading="lazy" alt="Photo by Lorenzo Herrera" className="absolute inset-0 h-full w-full object-cover object-center transition duration-200 group-hover:scale-110" />
          </a>

          <div className="flex flex-1 flex-col p-4 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">
              <a href="#" className="transition duration-100 hover:text-indigo-500 active:text-indigo-600">Working with legacy stacks</a>
            </h2>

            <p className="mb-8 text-gray-500">This is a section of some simple filler text, also known as placeholder text. It shares some characteristics of a real written text.</p>

            <div className="mt-auto flex items-end justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  <img src="https://images.unsplash.com/photo-1586116104126-7b8e839d5b8c?auto=format&q=75&fit=crop&w=64" loading="lazy" alt="Photo by peter bucks" className="h-full w-full object-cover object-center" />
                </div>

                <div>
                  <span className="block text-indigo-500">Jane Jackobs</span>
                  <span className="block text-sm text-gray-400">April 07, 2021</span>
                </div>
              </div>

              <span className="rounded border px-2 py-1 text-sm text-gray-500">Article</span>
            </div>
          </div>
        </div>
        {/* <!-- article - end --> */}

        {/* <!-- article - start --> */}
        <div className="flex flex-col overflow-hidden rounded-lg border bg-white">
          <a href="#" className="group relative block h-48 overflow-hidden bg-gray-100 md:h-64">
            <img src="https://images.unsplash.com/photo-1542759564-7ccbb6ac450a?auto=format&q=75&fit=crop&w=600" loading="lazy" alt="Photo by Magicle" className="absolute inset-0 h-full w-full object-cover object-center transition duration-200 group-hover:scale-110" />
          </a>

          <div className="flex flex-1 flex-col p-4 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">
              <a href="#" className="transition duration-100 hover:text-indigo-500 active:text-indigo-600">10 best smartphones for devs</a>
            </h2>

            <p className="mb-8 text-gray-500">This is a section of some simple filler text, also known as placeholder text. It shares some characteristics of a real written text.</p>

            <div className="mt-auto flex items-end justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  <img src="https://images.unsplash.com/photo-1592660503155-7599a37f06a6?auto=format&q=75&fit=crop&w=64" loading="lazy" alt="Photo by Jassir Jonis" className="h-full w-full object-cover object-center" />
                </div>

                <div>
                  <span className="block text-indigo-500">Tylor Grey</span>
                  <span className="block text-sm text-gray-400">March 15, 2021</span>
                </div>
              </div>

              <span className="rounded border px-2 py-1 text-sm text-gray-500">Article</span>
            </div>
          </div>
        </div>
        {/* <!-- article - end --> */}

        {/* <!-- article - start --> */}
        <div className="flex flex-col overflow-hidden rounded-lg border bg-white">
          <a href="#" className="group relative block h-48 overflow-hidden bg-gray-100 md:h-64">
            <img src="https://images.unsplash.com/photo-1610465299996-30f240ac2b1c?auto=format&q=75&fit=crop&w=600" loading="lazy" alt="Photo by Martin Sanchez" className="absolute inset-0 h-full w-full object-cover object-center transition duration-200 group-hover:scale-110" />
          </a>

          <div className="flex flex-1 flex-col p-4 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">
              <a href="#" className="transition duration-100 hover:text-indigo-500 active:text-indigo-600">8 High performance Notebooks</a>
            </h2>

            <p className="mb-8 text-gray-500">This is a section of some simple filler text, also known as placeholder text. It shares some characteristics of a real written text.</p>

            <div className="mt-auto flex items-end justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&q=75&fit=crop&w=64" loading="lazy" alt="Photo by Aiony Haust" className="h-full w-full object-cover object-center" />
                </div>

                <div>
                  <span className="block text-indigo-500">Ann Park</span>
                  <span className="block text-sm text-gray-400">January 27, 2021</span>
                </div>
              </div>

              <span className="rounded border px-2 py-1 text-sm text-gray-500">Article</span>
            </div>
          </div>
        </div>
        {/* <!-- article - end --> */}

        {/* <!-- article - start --> */}
        <div className="flex flex-col overflow-hidden rounded-lg border bg-white">
          <a href="#" className="group relative block h-48 overflow-hidden bg-gray-100 md:h-64">
            <img src="https://images.unsplash.com/photo-1610465299996-30f240ac2b1c?auto=format&q=75&fit=crop&w=600" loading="lazy" alt="Photo by Martin Sanchez" className="absolute inset-0 h-full w-full object-cover object-center transition duration-200 group-hover:scale-110" />
          </a>

          <div className="flex flex-1 flex-col p-4 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">
              <a href="#" className="transition duration-100 hover:text-indigo-500 active:text-indigo-600">8 High performance Notebooks</a>
            </h2>

            <p className="mb-8 text-gray-500">This is a section of some simple filler text, also known as placeholder text. It shares some characteristics of a real written text.</p>

            <div className="mt-auto flex items-end justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&q=75&fit=crop&w=64" loading="lazy" alt="Photo by Aiony Haust" className="h-full w-full object-cover object-center" />
                </div>

                <div>
                  <span className="block text-indigo-500">Ann Park</span>
                  <span className="block text-sm text-gray-400">January 27, 2021</span>
                </div>
              </div>

              <span className="rounded border px-2 py-1 text-sm text-gray-500">Article</span>
            </div>
          </div>
        </div>
        {/* <!-- article - end --> */}
      </div>
    </div>
  </div>
  </>
  );
}
