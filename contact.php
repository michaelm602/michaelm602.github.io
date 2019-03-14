<?php 

if (isset($_POST['submit'])) {

    $name = $_POST['name'];
    $mailfrom = $_POST['Email'];
    $subject = $_POST['subject'];
    $message = $_POST['message'];

    $mailto = "michaelm602@yahoo.com";
    $headers = "From: " .$mailfrom;
    $txt = "You received an email from " .$name.".\n\n".$message;

    mail($mailto, $subject, $txt, $headers);
    header("Location: index.php?mailsend");


}