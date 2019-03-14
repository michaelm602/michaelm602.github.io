<?php

// if the url field is empty
if(isset($_POST['url']) && $_POST['url'] == ''){

	// then send the form to your email
	mail( 'you@yoursite.com', 'Contact Form', print_r($_POST,true) );
}

// otherwise, let the spammer think that they got their message through

?>
