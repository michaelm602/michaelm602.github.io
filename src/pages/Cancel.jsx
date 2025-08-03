export default function Cancel() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-white bg-black">
            <h1 className="text-4xl font-bold mb-4">Order Canceled</h1>
            <p className="text-lg mb-6">Looks like you canceled your checkout. No worries — your cart is still safe.</p>
            <a href="/" className="text-blue-400 hover:underline">Return to Home</a>
        </div>
    );
}
