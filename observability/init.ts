// File khởi tạo observability để đảm bảo nó được thực hiện khi import
import { initializeObservability } from './startup';

console.log('Starting observability initialization...');
const telemetry = initializeObservability();
console.log('Observability initialization completed.');

export default telemetry;