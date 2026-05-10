import axiosClient from './axiosClient';

export const updateProfile = async (payload) => {
    return axiosClient.put('/users/profile', payload);
};

export const deleteAccount = async (password) => {
    return axiosClient.delete('/users/account', {
        data: { password },
    });
};
