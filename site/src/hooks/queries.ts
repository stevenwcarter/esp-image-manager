import { gql } from '@apollo/client';

// Uploads
export const CREATE_UPLOAD_GQL = gql`
  mutation CreateUpload($upload: UploadInput!) {
    createUpload(upload: $upload) {
      id
      message
      data
    }
  }
`;
