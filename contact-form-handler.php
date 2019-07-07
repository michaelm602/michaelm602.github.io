<?php
    $firstname = $_POST['firstname'];
    $lastname = $_POST['lastname'];
    $visitor_email = $_POST['email'];
    $services = $_POST['options'];
    $message = $_POST['message']

    $email_from = 'michaelm602@yahoo.com';

    $email_subject = "New Submission";

    $email_body = "User First Name: $firstname.\n".
                    "User Last Name: $lastname.\n". 
                    "User Email: $visitor_email.\n".
                    "Services: $services.\n".
                    "User Message: $message.\n".

    $to = "michaelm602@yahoo.com";
    $headers = "From: $email_from \r\n";
    $headers .= "Reply-To: $visitor_email \r\n";

    mail($to,$email_subject,$email_body,$headers);

    header("Location: index.html");

?>