import React, { createContext, useContext, useState, useMemo } from 'react';

const CartContext = createContext();

export function useCart() {
    return useContext(CartContext);
}

export function CartProvider({ children }) {
    const [cart, setCart] = useState([]);
    const [discountPercent, setDiscountPercent] = useState(0);

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product_id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock_quantity) {
                    window.dispatchEvent(new CustomEvent('toast', { detail: { message: `Max stock for "${product.name}" reached`, type: 'warning' } }));
                    return prev;
                }
                return prev.map(item =>
                    item.product_id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            } else {
                window.dispatchEvent(new CustomEvent('toast', { detail: { message: `${product.name} added`, type: 'success' } }));
                return [...prev, {
                    product_id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: 1,
                    max_stock: product.stock_quantity
                }];
            }
        });
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.product_id === productId) {
                    let newQty = item.quantity + delta;
                    if (newQty > item.max_stock) {
                        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Max stock reached', type: 'warning' } }));
                        newQty = item.max_stock;
                    }
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product_id !== productId));
    };

    const clearCart = () => setCart([]);

    const totals = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const discountAmount = subtotal * (discountPercent / 100);
        const taxable = subtotal - discountAmount;
        const taxRate = 10; // 10% tax rate matching backend
        const taxAmount = taxable * (taxRate / 100);
        const total = taxable + taxAmount;
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

        return { subtotal, discountAmount, taxAmount, total, taxRate, totalItems };
    }, [cart, discountPercent]);

    return (
        <CartContext.Provider value={{
            cart,
            addToCart,
            updateQuantity,
            removeFromCart,
            clearCart,
            totals,
            discountPercent,
            setDiscountPercent
        }}>
            {children}
        </CartContext.Provider>
    );
}
