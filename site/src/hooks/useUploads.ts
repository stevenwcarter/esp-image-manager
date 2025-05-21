// import { useMutation, useQuery } from '@apollo/client';
// import { useEffect, useState } from 'react';
// import { Upload } from 'types';
// import { CREATE_UPLOAD_GQL } from './queries';
//
//
// export const useClients = () => {
//   const [clients, setClients] = useState<Client[]>([]);
//   const [createClientMutation] = useMutation(CREATE_CLIENT_GQL, {
//     refetchQueries: [LIST_CLIENTS_GQL],
//   });
//   const [deleteClientMutation] = useMutation(DELETE_CLIENT_GQL, {
//     refetchQueries: [LIST_CLIENTS_GQL],
//   });
//   const { data } = useQuery<ListClientResponse>(LIST_CLIENTS_GQL);
//
//   useEffect(() => {
//     if (data && data.listClients) {
//       setClients(data.listClients);
//     }
//   }, [data]);
//
//   const createClient = async (client: Partial<Client>) => {
//     try {
//       await createClientMutation({
//         variables: { client },
//       });
//     } catch (error) {
//       console.error('Error creating client:', error);
//     }
//   };
//
//   const deleteClient = async (clientUuid: string) => {
//     try {
//       await deleteClientMutation({
//         variables: { clientUuid },
//       });
//     } catch (error) {
//       console.error('Error deleting client:', error);
//     }
//   };
//
//   return { clients, createClient, deleteClient };
// };
