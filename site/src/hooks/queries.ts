import { gql } from '@apollo/client';

// Uploads
export const CREATE_UPLOAD_GQL = gql`
  mutation CreateUpload($upload: UploadInput!) {
    createUpload(upload: $upload) {
      message
      data
    }
  }
`;

export const LIST_UPLOADS_GQL = gql`
  query ListUploads($limit: Int, $offset: Int) {
    listUploads(limit: $limit, offset: $offset) {
      uuid
      message
      data
      uploadedAt
    }
  }
`;
