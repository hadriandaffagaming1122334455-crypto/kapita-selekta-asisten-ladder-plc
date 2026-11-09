// Rentang alamat. COCOKKAN dengan manual W479/W480 untuk model CP1E yang dipakai.
// Disesuaikan dari program CX-Programmer: 0.00, 10.00 (CIO work), W1.01, 100.12, T010.
export const ADDRESS_CONFIG = {
  inputWords: [0, 1],
  inputBitsPerWord: 16,
  outputWords: [100, 101],
  outputBitsPerWord: 16,
  cioWorkMin: 2, // CIO 2.00 - 99.15 dianggap bit kerja (mis. 10.00 "Holding")
  cioWorkMax: 99,
  workMaxWord: 99, // W0.00 - W99.15
  maxTimerNo: 255,
};
