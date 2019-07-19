<?php


    if (isset($_POST['submit'])) {
        $name = $_POST['name']
        $services = $_POST['services']
        $mailFrom = $_POST['email']
        $message = $_POST['message']

        $mailTo = "michaelm602@yahoo.com";
        $headers = "From: ".$mailFrom;
        $txt = "You received an from ".$name.".\n\n".$message;

        mail($mailTo, $services, $txt, $headers);
        header("Location: index.html?mailsend")
    }

?>