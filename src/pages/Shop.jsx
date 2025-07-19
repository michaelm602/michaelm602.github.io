import '../styles/Shop.css';

const shopItems = [
    {
        id: 1,
        title: 'Cosmic Titan',
        image: '/images/shop/cosmic-titan.jpg', //drop an atual file here later
        price: 250,
        medium: 'Acrylic on Canvas',
        size: '24x36 inches',
        available: true,
    },
    {
        id: 2,
        title: 'Urban Myth',
        image: '/images/shop/urban-myth.jpg',
        price: 45,
        medium: 'Print on Premium Matte',
        size: '12x18 inches',
        available: false,
    },
    // Add more pieces as you go
];

export default function Shop() {
    return (
        <div className='shop-container'>
            <h2>Available Artworks</h2>
            <div className='shop-grid'>
                {shopItems.map((item) => (
                    <div key={item.id} className="shop-card">
                        <img src="item.image" alt={item.title} className='shop-image' />
                        <div className='shop-info'>
                            <h3>{item.title}</h3>
                            <p>{item.medium}</p>
                            <p>{item.size}</p>
                            <p>${item.price}</p>
                            {item.available ? (
                                <button className='buy-btn'>Buy</button>
                            ) : (
                                <span className='sold-out'>Sold Out</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}