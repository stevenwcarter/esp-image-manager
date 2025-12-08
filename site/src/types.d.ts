export type Upload = {
  uuid: string;
  message?: string;
  data: string;
  uploadedAt?: string;
  name?: string;
  png?: string;
  display?: string;
};

export type UploadInput = {
  message?: string;
  data: string;
  public: boolean;
  name?: string;
  display?: string;
};
