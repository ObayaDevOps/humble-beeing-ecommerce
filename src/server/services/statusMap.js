// src/server/services/statusMap.js
// Single source-of-truth for mapping Pesapal status codes to internal statuses.

export const mapPesapalStatus = (statusCode) => {
  switch (Number(statusCode)) {
    case 0:
      return 'INVALID';
    case 1:
      return 'COMPLETED';
    case 2:
      return 'FAILED';
    case 3:
      return 'REVERSED';
    default:
      return 'PENDING';
  }
};

