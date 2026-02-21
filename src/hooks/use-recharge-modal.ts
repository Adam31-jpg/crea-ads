import { create } from 'zustand';

interface RechargeModalStore {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}

export const useRechargeModal = create<RechargeModalStore>((set) => ({
    isOpen: false,
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false }),
}));
