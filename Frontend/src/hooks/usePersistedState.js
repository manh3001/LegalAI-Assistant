import { useState, useEffect } from 'react';

export default function usePersistedState(key, initialValue) {
    // 1. Khởi tạo state: Ưu tiên lấy từ localStorage, nếu không có mới dùng initialValue
    const [value, setValue] = useState(() => {
        try {
            const savedValue = localStorage.getItem(key);
            if (savedValue !== null) {
                return JSON.parse(savedValue);
            }
        } catch (error) {
            console.warn(`Lỗi đọc localStorage key "${key}":`, error);
        }
        return initialValue;
    });

    // 2. Mỗi khi state thay đổi, tự động lưu ngầm xuống localStorage
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`Lỗi lưu localStorage key "${key}":`, error);
        }
    }, [key, value]);

    return [value, setValue];
}