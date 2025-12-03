export type Upload = {
  id: number;
  message?: string;
  data: string;
  uploadedAt?: string;
};

export type UploadInput = {
  message?: string;
  data: string;
  public: boolean;
};
