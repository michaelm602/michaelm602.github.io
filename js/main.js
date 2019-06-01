const heading = 'Thanks for checking out the website';
let i = 0;
console.log(heading.length);
const typing = () => {
    if(i < heading.length) {
        document.querySelector('.heading').innerHTML += heading.charAt(i);
        i++;

        setTimeout(typing, 100);
    }
}
typing();


document.querySelector('.sites-btn').addEventListener
('click', () => {
    document.querySelector('.cards-wrapper').style.display = 'none';
    document.querySelector('.website-wrapper').style.cssText = 'opacity: 1; visibility: visible';
    document.querySelector('.x-btn').style.cssText = 'opacity: 1; visibility: visible';
	document.querySelector('.heading').style.display = 'none';
});

document.querySelector('.x-btn').addEventListener
('click', () => {
    document.querySelector('.cards-wrapper').style.display = 'flex';
    document.querySelector('.website-wrapper').style.cssText = 'opacity: 0; visibility: hidden';
    document.querySelector('.x-btn').style.cssText = 'opacity: 0; visibility: hidden';
    document.querySelector('.heading').style.cssText = 'opacity: 1 visibility: visible';
});



