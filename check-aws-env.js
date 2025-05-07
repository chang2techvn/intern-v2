// Script đơn giản để kiểm tra các biến môi trường AWS
import dotenv from 'dotenv';

// Tải biến môi trường từ file .env
dotenv.config();

// Kiểm tra và in các biến môi trường AWS (che giấu phần nhạy cảm)
function checkAwsEnv() {
  console.log('===== KIỂM TRA BIẾN MÔI TRƯỜNG AWS =====');
  
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
  const region = process.env.AWS_REGION || '';
  const secretName = process.env.DB_SECRET_NAME || '';
  
  console.log(`AWS_REGION: ${region}`);
  console.log(`DB_SECRET_NAME: ${secretName}`);
  
  // In phần đầu của access key và che phần còn lại
  if (accessKeyId) {
    const visiblePart = accessKeyId.substring(0, 4);
    const hiddenPart = '*'.repeat(Math.max(0, accessKeyId.length - 4));
    console.log(`AWS_ACCESS_KEY_ID: ${visiblePart}${hiddenPart} (độ dài: ${accessKeyId.length})`);
  } else {
    console.log('AWS_ACCESS_KEY_ID: Không được thiết lập');
  }
  
  // Chỉ kiểm tra xem secret access key có tồn tại không
  if (secretAccessKey) {
    console.log(`AWS_SECRET_ACCESS_KEY: ${'*'.repeat(8)} (độ dài: ${secretAccessKey.length})`);
  } else {
    console.log('AWS_SECRET_ACCESS_KEY: Không được thiết lập');
  }
  
  console.log('\nKiểm tra các biến môi trường khác liên quan đến AWS:');
  
  // Kiểm tra các biến môi trường AWS khác có thể ảnh hưởng đến xác thực
  for (const key in process.env) {
    if (key.startsWith('AWS_') && 
        key !== 'AWS_ACCESS_KEY_ID' && 
        key !== 'AWS_SECRET_ACCESS_KEY' &&
        key !== 'AWS_REGION') {
      console.log(`${key}: ${process.env[key]}`);
    }
  }
  
  console.log('\n===== KIỂM TRA HOÀN TẤT =====');
}

// Chạy hàm kiểm tra
checkAwsEnv();