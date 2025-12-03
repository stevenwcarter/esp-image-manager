import { useMutation, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { UploadInput, Upload } from 'types';
import { CREATE_UPLOAD_GQL, LIST_UPLOADS_GQL } from './queries';

type ListUploadResponse = {
  listUploads: Upload[];
};
type CreateUploadResponse = {
  createUpload: Upload;
};

export const useUploads = () => {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [createUploadMutation] = useMutation<CreateUploadResponse>(CREATE_UPLOAD_GQL, {
    refetchQueries: [LIST_UPLOADS_GQL],
  });
  const { data } = useQuery<ListUploadResponse>(LIST_UPLOADS_GQL);

  useEffect(() => {
    if (data && data.listUploads) {
      setUploads(data.listUploads);
    }
  }, [data]);

  const createUpload = async (upload: UploadInput) => {
    try {
      await createUploadMutation({
        variables: { upload },
      });
    } catch (error) {
      console.error('Error creating upload:', error);
    }
  };

  // const deleteUpload = async (uploadUuid: string) => {
  //   try {
  //     await deleteUploadMutation({
  //       variables: { uploadUuid },
  //     });
  //   } catch (error) {
  //     console.error('Error deleting upload:', error);
  //   }
  // };

  return { uploads, createUpload };
};
