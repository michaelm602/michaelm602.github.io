<?php
    $name = $_POST['firstname, lastname'];
    $email = $_POST['email'];
    $message = $_POST['message'];
    $selection = $_POST['selection'];
    $from = 'From: michaelm602.github.io'; 
    $to = 'michaelm602@yahoo.com';
    $subject = 'Services';

    $body = "From: $name\n E-Mail: $email\n Message:\n $message";

    if ($_POST['submit']) {				 
        if (mail ($to, $subject, $body, $from)) { 
	    echo '<p>Your message has been sent!</p>';
	} else { 
	    echo '<p>Something went wrong, go back and try again!</p>'; 
	} 
    } 

?>