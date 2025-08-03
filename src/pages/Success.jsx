export default function Success() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-white bg-black">
            <h1 className="text-4xl font-bold mb-4">Thank you for your order!</h1>
            <p className="text-lg mb-6">You’ll receive a confirmation email shortly.</p>
            <a href="/" className="text-green-400 hover:underline">Return to Home</a>
        </div>
    );
}
