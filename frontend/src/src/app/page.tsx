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

  const auth = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // デフォルトのボタン動作をキャンセル
    event.preventDefault();

    window.location.href = 'https://localhost/api/auth';
  }

  const getAllItems = async () => {
    try {
      const response = await axios.get('https://localhost/api/file/items');
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
  <>
  <div className="bg-white py-6 sm:py-8 lg:py-12">
    <div className="mx-auto max-w-screen-2xl px-4 md:px-8">
      <h2 className="mb-4 text-center text-2xl font-bold text-gray-800 md:mb-8 lg:text-3xl">fyfy</h2>
      <form className="mx-auto max-w-lg rounded-lg border">
        <div className="flex flex-col gap-4 p-4 md:p-8">
          <button onClick={auth} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-8 py-3 text-center text-sm font-semibold text-gray-800 outline-none ring-gray-300 transition duration-100 hover:bg-gray-100 focus-visible:ring active:bg-gray-200 md:text-base">
            <svg className="h-5 w-5 shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23.7449 12.27C23.7449 11.48 23.6749 10.73 23.5549 10H12.2549V14.51H18.7249C18.4349 15.99 17.5849 17.24 16.3249 18.09V21.09H20.1849C22.4449 19 23.7449 15.92 23.7449 12.27Z" fill="#4285F4" />
              <path d="M12.2549 24C15.4949 24 18.2049 22.92 20.1849 21.09L16.3249 18.09C15.2449 18.81 13.8749 19.25 12.2549 19.25C9.12492 19.25 6.47492 17.14 5.52492 14.29H1.54492V17.38C3.51492 21.3 7.56492 24 12.2549 24Z" fill="#34A853" />
              <path d="M5.52488 14.29C5.27488 13.57 5.14488 12.8 5.14488 12C5.14488 11.2 5.28488 10.43 5.52488 9.71V6.62H1.54488C0.724882 8.24 0.254883 10.06 0.254883 12C0.254883 13.94 0.724882 15.76 1.54488 17.38L5.52488 14.29Z" fill="#FBBC05" />
              <path d="M12.2549 4.75C14.0249 4.75 15.6049 5.36 16.8549 6.55L20.2749 3.13C18.2049 1.19 15.4949 0 12.2549 0C7.56492 0 3.51492 2.7 1.54492 6.62L5.52492 9.71C6.47492 6.86 9.12492 4.75 12.2549 4.75Z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>
      </form>
    </div>
  </div>
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
