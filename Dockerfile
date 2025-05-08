# Use the official PHP 8.1 image with Apache
FROM php:8.1-apache

# Update and install utilities (e.g., for handling zip files)
RUN apt-get update && apt-get install -y \
    libzip-dev zip unzip apache2

# Enable Apache mod_rewrite (for pretty URLs, optional)
RUN a2enmod rewrite

# Copy the application files into Apache's document root
COPY . /var/www/html/

# Set proper ownership/permissions on the copied files
RUN chown -R www-data:www-data /var/www/html

# Expose port 80 for HTTP
EXPOSE 80

# Ensure Apache is installed and running in the foreground
CMD ["/usr/sbin/apache2", "-D", "FOREGROUND"]
