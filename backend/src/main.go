package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

// AWS S3の設定
const (
	S3Endpoint = "http://localstack:4566" // LocalStackのS3エンドポイント
	S3Region   = "ap-northeast-1"
	S3Bucket   = "my-local-bucket" // アップロード先のバケット名
)

func main() {
	http.HandleFunc("/upload", uploadFile)
	fmt.Println("Server listening on port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// 鍵の長さを適切な長さにパディングまたはトリミングする関数
func createKey(passPhrase string) []byte {
	key := []byte(passPhrase)
	if len(key) < 16 {
		key = append(key, bytes.Repeat([]byte{0}, 16-len(key))...)
	} else if len(key) > 16 && len(key) < 24 {
		key = append(key, bytes.Repeat([]byte{0}, 24-len(key))...)
	} else if len(key) > 24 && len(key) < 32 {
		key = append(key, bytes.Repeat([]byte{0}, 32-len(key))...)
	} else if len(key) > 32 {
		key = key[:32]
	}
	return key
}

// AES暗号化
func encrypt(data []byte, passPhrase string) ([]byte, error) {
	key := createKey(passPhrase)

	// AESブロック暗号を生成
	block, err := aes.NewCipher(key)
	if err != nil {
		fmt.Println("encrypt block err")
		fmt.Println(err)
		return nil, err
	}

	// Galois/Counter Mode (GCM) を使用するためのインターフェースを生成
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		fmt.Println("encrypt gcm err")
		fmt.Println(err)
		return nil, err
	}

	// GCMのNonce (Number used once) を生成
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		fmt.Println("encrypt readFull err")
		fmt.Println(err)
		return nil, err
	}

	// データを暗号化し、nonceを含む暗号文を生成
	cipherText := gcm.Seal(nonce, nonce, data, nil)

	return cipherText, nil
}

// // AES復号化
// func decrypt(data []byte, passphrase string) ([]byte, error) {
// 	// AESブロック暗号を生成
// 	block, err := aes.NewCipher([]byte(passphrase))
// 	if err != nil {
// 		return nil, err
// 	}

// 	// Galois/Counter Mode (GCM) を使用するためのインターフェースを生成
// 	gcm, err := cipher.NewGCM(block)
// 	if err != nil {
// 		return nil, err
// 	}

// 	// GCMのNonce (Number used once) サイズを取得
// 	nonceSize := gcm.NonceSize()
// 	if len(data) < nonceSize {
// 		return nil, fmt.Errorf("ciphertext too short")
// 	}

// 	// Nonceと暗号文を分割
// 	nonce, ciphertext := data[:nonceSize], data[nonceSize:]

// 	// データを復号化し、プレーンテキストを生成
// 	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
// 	if err != nil {
// 		return nil, err
// 	}

// 	return plaintext, nil
// }

func uploadFile(w http.ResponseWriter, r *http.Request) {
	// LocalStackのS3クライアントを作成
	sess := session.Must(session.NewSession(&aws.Config{
		Endpoint:         aws.String(S3Endpoint),
		Region:           aws.String(S3Region), // リージョンは適宜変更してください
		Credentials:      credentials.NewStaticCredentials("dummy", "dummy", ""),
		S3ForcePathStyle: aws.Bool(true),
	}))
	svc := s3.New(sess)

	// バケットの存在確認
	_, err := svc.HeadBucket(&s3.HeadBucketInput{
		Bucket: aws.String(S3Bucket),
	})
	if err != nil {
		// バケットの作成
		bucketName := S3Bucket
		_, err = svc.CreateBucket(&s3.CreateBucketInput{
			Bucket: aws.String(bucketName),
		})
		if err != nil {
			log.Fatalf("Failed to create bucket: %v", err)
		}

		// バケットが正常に作成されたことを確認
		fmt.Printf("Successfully created bucket %s\n", bucketName)
	} else {
		fmt.Printf("Bucket %s exists\n", S3Bucket)
	}

	// todo:エラーチェック
	// r.ParseMultipartForm(10 << 20) // 最大10MBまでのファイルを処理できるように設定

	file, handler, err := r.FormFile("pdfFile")
	if err != nil {
		fmt.Println("Error retrieving the file")
		fmt.Println(err)
		return
	}
	defer file.Close()

	// ファイル内容をバイトスライスに読み取る
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		fmt.Println("Error reading the file")
		fmt.Println(err)
		return
	}

	fmt.Printf("Uploaded File: %+v\n", handler.Filename)
	fmt.Printf("File Size: %+v\n", handler.Size)
	fmt.Printf("MIME Header: %+v\n", handler.Header)
	// fmt.Printf("File Bytes: %v\n", fileBytes)

	// AES暗号化
	encryptedData, err := encrypt(fileBytes, "thisis16byteskey")
	if err != nil {
		fmt.Println("Failed to encrypt data:", err)
		return
	}

	// 確認のために暗号化されたデータを出力
	// fmt.Printf("Encrypted Data: %x\n", encryptedData)

	// S3にファイルをアップロード
	_, err = svc.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(S3Bucket),
		// S3にアップロードする際のオブジェクトキー
		Key: aws.String(handler.Filename),
		// Body: aws.ReadSeekCloser(bytes.NewReader(encryptedData)),
		Body: bytes.NewReader(encryptedData),
	})
	if err != nil {
		fmt.Println("Error uploading to S3:", err)
		http.Error(w, "Failed to upload file to S3", http.StatusInternalServerError)
		return
	}

	fmt.Fprintf(w, "Successfully uploaded file to S3\n")
}

// func makeBucket() error {

// 	return nil , error
// }
